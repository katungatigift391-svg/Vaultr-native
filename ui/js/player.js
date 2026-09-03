/**
 * Video Playback & Stream Switching Engine
 * Auto-selects cleanest available source (none → light → heavy).
 */
const AD_LEVEL_RANK = { none: 0, light: 1, heavy: 2 };
const NATIVE_TIMEOUT_MS = 8000; // fallback to embed if native player stalls

const Player = {
  currentMedia: null,
  currentSources: [],
  hlsInstance: null,
  nativeFallbackTimer: null,

  init() {
    this.overlay = document.getElementById('player-overlay');
    this.closeBtn = document.getElementById('player-close-btn');
    this.titleEl = document.getElementById('player-media-title');
    this.subEl = document.getElementById('player-media-sub');
    this.sourceListEl = document.getElementById('player-source-list');

    this.nativeBox = document.getElementById('native-player-box');
    this.embedBox = document.getElementById('embed-player-box');
    this.videoEl = document.getElementById('native-video');
    this.iframeEl = document.getElementById('embed-iframe');
    this.lightsBtn = document.getElementById('btn-cinema-lights');

    this.closeBtn.addEventListener('click', () => this.close());
    this.lightsBtn.addEventListener('click', () => this.toggleFocusMode());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (this.overlay.classList.contains('hidden')) return;
      if (e.key === 'Escape') this.close();
      else if (e.code === 'Space' && this.nativeBox.classList.contains('active')) {
        e.preventDefault();
        this.videoEl.paused ? this.videoEl.play() : this.videoEl.pause();
      } else if (e.key.toLowerCase() === 'f') {
        this.toggleFullscreen();
      }
    });

    // Save playback progress
    this.videoEl.addEventListener('timeupdate', () => {
      if (this.currentMedia && this.videoEl.duration) {
        State.saveProgress({
          ...this.currentMedia,
          currentTime: this.videoEl.currentTime,
          duration: this.videoEl.duration
        });
      }
    });

    // Initialize Anti-Redirect & Anti-Popup Guard
    this.setupRedirectGuard();
  },

  async open(media, initialSourceIndex = 0) {
    this.currentMedia = media;
    this.titleEl.textContent = media.title || media.name;
    this.subEl.textContent = media.media_type === 'tv'
      ? `Season ${media.season || 1} • Episode ${media.episode || 1}`
      : 'Movie';

    this.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    UI.showToast('Connecting to stream providers...', 'info');

    try {
      const response = await API.resolveStreams(
        media.media_type, media.id, media.season || 1, media.episode || 1
      );

      if (response.success && response.data) {
        this.currentSources = response.data.activeSources || [];
        this.renderSourceButtons(this.currentSources);

        if (this.currentSources.length > 0) {
          // Auto-select best source by adLevel (already sorted server-side)
          const bestIndex = initialSourceIndex || 0;
          this.playSource(this.currentSources[bestIndex], bestIndex);
        } else if (response.data.primaryEmbed) {
          this.playEmbed(response.data.primaryEmbed);
        }
      }
    } catch (err) {
      console.error('Player resolution error:', err);
      // Hard fallback — VidLink clean embed
      const fallbackUrl = media.media_type === 'tv'
        ? `https://vidlink.pro/tv/${media.id}/${media.season || 1}/${media.episode || 1}?autoplay=true`
        : `https://vidlink.pro/movie/${media.id}?autoplay=true`;
      this.playEmbed(fallbackUrl);
    }
  },

  renderSourceButtons(sources) {
    this.sourceListEl.innerHTML = '';

    sources.forEach((source, index) => {
      const btn = document.createElement('button');
      btn.className = `source-btn${index === 0 ? ' active' : ''}`;
      btn.dataset.index = index;

      // Build badge
      const badgeClass = source.isDirect
        ? 'badge-free'
        : source.adLevel === 'none'
          ? 'badge-free'
          : source.adLevel === 'light'
            ? 'badge-light'
            : 'badge-ads';

      const badgeLabel = source.isDirect
        ? 'AD-FREE'
        : source.adLevel === 'none'
          ? 'CLEAN'
          : source.adLevel === 'light'
            ? 'AD-LIGHT'
            : 'ADS';

      btn.innerHTML = `${source.name} <span class="${badgeClass}">${badgeLabel}</span>`;

      btn.addEventListener('click', () => {
        this.sourceListEl.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.playSource(source, index);
      });

      this.sourceListEl.appendChild(btn);
    });
  },

  playSource(source, index = 0) {
    if (!source || !source.url) return;
    this._clearNativeFallbackTimer();

    if (source.isDirect || source.url.includes('.m3u8') || source.url.includes('.mp4')) {
      this.playDirectStream(source.url, source.referer, source, index);
    } else {
      this.playEmbed(source.url);
    }
  },

  playEmbed(embedUrl) {
    this._clearNativeFallbackTimer();
    this.nativeBox.classList.remove('active');
    this.embedBox.classList.add('active');

    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }
    this.videoEl.pause();
    this.videoEl.src = '';
    this.iframeEl.src = embedUrl;
  },

  playDirectStream(streamUrl, referer = '', source, sourceIndex) {
    this.embedBox.classList.remove('active');
    this.nativeBox.classList.add('active');
    this.iframeEl.src = '';

    const proxiedUrl = `http://127.0.0.1:3000/api/proxy/hls?url=${encodeURIComponent(streamUrl)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}`;

    if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
      this.hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 5
      });
      this.hlsInstance.loadSource(proxiedUrl);
      this.hlsInstance.attachMedia(this.videoEl);

      this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        this._clearNativeFallbackTimer();
        this.videoEl.play().catch(e => console.warn('Autoplay prevented:', e));
        UI.showToast('▶ Ad-free stream loaded', 'success');
      });

      // If native stream stalls, fall back to the iframe embed of the same source
      this.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.warn('[HLS] Fatal error, falling back to embed:', data.type);
          this._tryEmbedFallback(source, sourceIndex);
        }
      });

      // Safety timer — if nothing loads after NATIVE_TIMEOUT_MS, switch to embed
      this.nativeFallbackTimer = setTimeout(() => {
        if (this.videoEl.readyState < 2) {
          console.warn('[Player] Native stream timed out, falling back to embed');
          this._tryEmbedFallback(source, sourceIndex);
        }
      }, NATIVE_TIMEOUT_MS);

    } else {
      this.videoEl.src = streamUrl;
      this.videoEl.play().catch(e => console.warn('Autoplay prevented:', e));
    }
  },

  _tryEmbedFallback(source, sourceIndex) {
    this._clearNativeFallbackTimer();
    if (this.hlsInstance) { this.hlsInstance.destroy(); this.hlsInstance = null; }

    // Find next embed source
    const embedSource = this.currentSources.find((s, i) => i > (sourceIndex || 0) && !s.isDirect);
    if (embedSource) {
      UI.showToast(`Switching to ${embedSource.name}...`, 'info');
      const idx = this.currentSources.indexOf(embedSource);
      this.sourceListEl.querySelectorAll('.source-btn').forEach((b, i) => {
        b.classList.toggle('active', i === idx);
      });
      this.playEmbed(embedSource.url);
    } else if (source) {
      // Use the source's own embed URL as last resort
      const fallbackEmbed = source.embedUrl || source.url;
      this.playEmbed(fallbackEmbed);
    }
  },

  _clearNativeFallbackTimer() {
    if (this.nativeFallbackTimer) {
      clearTimeout(this.nativeFallbackTimer);
      this.nativeFallbackTimer = null;
    }
  },

  toggleFocusMode() {
    this.overlay.classList.toggle('focus-mode');
    UI.showToast('Cinema Focus Mode Toggled', 'info');
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.overlay.requestFullscreen?.().catch(e => console.warn(e));
    } else {
      document.exitFullscreen?.().catch(e => console.warn(e));
    }
  },

  close() {
    this._clearNativeFallbackTimer();
    this.isUserNavigating = true;
    this.overlay.classList.add('hidden');
    document.body.style.overflow = '';
    this.iframeEl.src = '';
    if (this.hlsInstance) { this.hlsInstance.destroy(); this.hlsInstance = null; }
    this.videoEl.pause();
    this.videoEl.src = '';
  },

  // Anti-Redirect & Anti-Popup Guard
  setupRedirectGuard() {
    this.isUserNavigating = false;

    // 2. Override window.open to suppress ad popups/popunders
    const _originalOpen = window.open;
    window.open = (url, target, features) => {
      if (this.overlay && !this.overlay.classList.contains('hidden')) {
        console.warn('[Anti-Redirect] Blocked unauthorized window.open:', url);
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast('Blocked unauthorized ad redirect/popup', 'info');
        }
        return null;
      }
      return _originalOpen.call(window, url, target, features);
    };

    // 3. Keep top frame from being navigated away via popstate/history trap
    window.addEventListener('popstate', () => {
      if (this.overlay && !this.overlay.classList.contains('hidden') && !this.isUserNavigating) {
        history.pushState(null, '', location.href);
      }
    });
  }
};
