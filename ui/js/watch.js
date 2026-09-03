/**
 * Dedicated Watch Page Controller — Vaultr Cinema Theater
 * Features MovieBox-style episode matrix, compact server selector, and in-app trailer lightbox.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Parse URL Parameters
  const params = new URLSearchParams(window.location.search);
  const mediaType = params.get('type') || 'movie';
  const mediaId = params.get('id') || '550'; // Default to Fight Club if none provided
  let currentSeason = parseInt(params.get('season') || '1', 10);
  let currentEpisode = parseInt(params.get('episode') || '1', 10);

  // DOM Elements
  const watchTitle = document.getElementById('watch-title');
  const watchBadgeType = document.getElementById('watch-badge-type');
  const watchYear = document.getElementById('watch-year');
  const watchRating = document.getElementById('watch-rating');
  const watchSynopsis = document.getElementById('watch-synopsis');
  const watchGenres = document.getElementById('watch-genres');
  const watchLang = document.getElementById('watch-lang');
  const watchStatus = document.getElementById('watch-status');
  const watchCast = document.getElementById('watch-cast');
  const serverDropdown = document.getElementById('server-select-dropdown');
  const labelActiveServer = document.getElementById('label-active-server');
  const pillStatusText = document.getElementById('pill-status-text');
  const audioPickerPill = document.getElementById('audio-picker-pill');
  const audioTrackDropdown = document.getElementById('audio-track-dropdown');
  const audioStatusText = document.getElementById('audio-status-text');

  // Player Containers
  const nativePlayerBox = document.getElementById('native-player-box');
  const embedPlayerBox = document.getElementById('embed-player-box');
  const nativeVideo = document.getElementById('native-video');
  const embedIframe = document.getElementById('embed-iframe');

  // Navigation & Controls
  const btnPrevEp = document.getElementById('btn-prev-ep');
  const btnNextEp = document.getElementById('btn-next-ep');
  const btnTheaterFocus = document.getElementById('btn-theater-focus');
  const btnTrailerWatch = document.getElementById('btn-trailer-watch');
  const btnWatchlist = document.getElementById('btn-add-watchlist-watch');
  const btnReloadStream = document.getElementById('btn-reload-stream');
  const btnOpenServerModal = document.getElementById('btn-open-server-modal');
  const serverModal = document.getElementById('server-modal');
  const serverModalClose = document.getElementById('server-modal-close');
  const serverChoiceList = document.getElementById('server-choice-list');

  // TV Elements
  const tvEpisodesPanel = document.getElementById('tv-episodes-panel');
  const seasonPicker = document.getElementById('season-picker');
  const movieboxTileMatrix = document.getElementById('moviebox-tile-matrix');
  const checkAutoNext = document.getElementById('check-auto-next');
  const episodesCountText = document.getElementById('episodes-count-text');

  // Trailer Modal
  const trailerModal = document.getElementById('trailer-modal');
  const trailerModalClose = document.getElementById('trailer-modal-close');
  const trailerIframe = document.getElementById('trailer-iframe');

  // State
  let currentSources = [];
  let currentActiveSourceIndex = 0;
  let hlsInstance = null;
  let mediaDetails = null;
  let currentSeasonEpisodes = [];
  let isUserNavigating = false;

  // Toast Helper
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'ph-check-circle' : type === 'error' ? 'ph-warning-circle' : 'ph-info';
    toast.innerHTML = `<i class="ph-fill ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Anti-Redirect Guard
  function setupAntiRedirectGuard() {
    window.addEventListener('beforeunload', (e) => {
      if (!isUserNavigating) {
        e.preventDefault();
        e.returnValue = 'Playback in progress. Prevented unauthorized redirect.';
        return e.returnValue;
      }
    });

    const _originalOpen = window.open;
    window.open = (url, target, features) => {
      console.warn('[Anti-Redirect] Blocked unauthorized window.open:', url);
      showToast('Blocked unauthorized ad popup/redirect', 'info');
      return null;
    };
  }

  // 1. Load Media Metadata
  async function loadMediaDetails() {
    try {
      const res = await API.getDetails(mediaType, mediaId);
      if (!res.success || !res.data) throw new Error('Details not found');
      mediaDetails = res.data;

      const title = mediaDetails.title || mediaDetails.name;
      document.title = `${title} — Vaultr Cinema`;
      watchTitle.textContent = title;
      watchBadgeType.textContent = mediaType.toUpperCase();
      const releaseDate = mediaDetails.release_date || mediaDetails.first_air_date || '';
      watchYear.textContent = releaseDate.substring(0, 4) || '2024';
      watchRating.innerHTML = `<i class="ph-fill ph-star"></i> ${mediaDetails.vote_average ? mediaDetails.vote_average.toFixed(1) : '8.5'}`;
      watchSynopsis.textContent = mediaDetails.overview || 'No description available.';
      watchLang.textContent = (mediaDetails.original_language || 'en').toUpperCase();
      watchStatus.textContent = mediaDetails.status || 'Released';

      // Genres
      watchGenres.innerHTML = '';
      (mediaDetails.genres || []).forEach(g => {
        const badge = document.createElement('span');
        badge.className = 'genre-badge';
        badge.textContent = g.name;
        watchGenres.appendChild(badge);
      });

      // Cast
      const castNames = (mediaDetails.credits?.cast || []).slice(0, 6).map(c => c.name).join(', ');
      watchCast.textContent = castNames || 'N/A';

      // Watchlist Button State
      updateWatchlistBtn();

      // Trailer Setup
      const trailer = mediaDetails.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      if (trailer) {
        btnTrailerWatch.onclick = () => openTrailer(trailer.key);
      } else {
        btnTrailerWatch.classList.add('hidden');
      }

      // TV Series Setup
      if (mediaType === 'tv') {
        setupTvSeriesUI();
      }

      // Recommendations
      loadRecommendations(mediaDetails.recommendations?.results || mediaDetails.similar?.results || []);

    } catch (err) {
      console.error('Failed to load media details:', err);
      showToast('Could not load full metadata', 'error');
    }
  }

  // 2. Load Streams and Resolvers
  async function loadStreams(season = currentSeason, episode = currentEpisode) {
    showToast(`Resolving streams for ${mediaType === 'tv' ? `S${season}:E${episode}` : 'Movie'}...`, 'info');

    try {
      const res = await API.resolveStreams(mediaType, mediaId, season, episode);
      if (res.success && res.data) {
        currentSources = res.data.activeSources || [];
        populateServerDropdown(currentSources);
        populateServerModal(currentSources);

        if (currentSources.length > 0) {
          playSource(currentSources[0], 0);
        } else if (res.data.primaryEmbed) {
          playEmbed(res.data.primaryEmbed);
        }
      }
    } catch (err) {
      console.error('Stream resolution failed:', err);
      // Hard fallback
      const fallbackUrl = mediaType === 'tv'
        ? `https://vidlink.pro/tv/${mediaId}/${season}/${episode}?autoplay=true`
        : `https://vidlink.pro/movie/${mediaId}?autoplay=true`;
      playEmbed(fallbackUrl);
    }
  }

  // Populate Server Dropdown & Modal
  function populateServerDropdown(sources) {
    serverDropdown.innerHTML = '';
    sources.forEach((s, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${s.name} [${(s.adLevel || 'light').toUpperCase()}]`;
      serverDropdown.appendChild(opt);
    });

    serverDropdown.onchange = (e) => {
      const idx = parseInt(e.target.value, 10);
      playSource(sources[idx], idx);
    };
  }

  function populateServerModal(sources) {
    serverChoiceList.innerHTML = '';
    sources.forEach((s, idx) => {
      const item = document.createElement('div');
      item.className = `server-choice-item ${idx === currentActiveSourceIndex ? 'active' : ''}`;
      
      const badgeClass = s.isDirect ? 'badge-free' : s.adLevel === 'light' ? 'badge-light' : 'badge-ads';
      const badgeLabel = s.isDirect ? 'AD-FREE DIRECT' : s.adLevel === 'none' ? 'CLEAN' : s.adLevel === 'light' ? 'AD-LIGHT' : 'ADS';

      item.innerHTML = `
        <div class="server-choice-info">
          <h5>${s.name}</h5>
          <span class="${badgeClass}">${badgeLabel}</span>
        </div>
        <button class="btn btn-secondary btn-sm">Select</button>
      `;

      item.onclick = () => {
        serverModal.classList.add('hidden');
        serverDropdown.value = idx;
        playSource(s, idx);
      };

      serverChoiceList.appendChild(item);
    });
  }

  // 3. Playback Handlers
  function playSource(source, index = 0) {
    if (!source || !source.url) return;
    currentActiveSourceIndex = index;
    labelActiveServer.textContent = source.name;
    pillStatusText.textContent = source.isDirect ? 'Ad-Free Direct Stream (HLS)' : `Clean Stream • ${source.adLevel?.toUpperCase() || 'LIGHT'}`;
    serverDropdown.value = index;

    if (source.isDirect || source.url.includes('.m3u8') || source.url.includes('.mp4')) {
      playDirectStream(source.url, source.referer);
    } else {
      playEmbed(source.url);
    }
  }

  function playEmbed(url) {
    nativePlayerBox.classList.remove('active');
    embedPlayerBox.classList.add('active');

    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    nativeVideo.pause();
    nativeVideo.src = '';
    embedIframe.src = url;

    // Reset audio info for embed
    audioTrackDropdown.innerHTML = '<option value="-1">Audio: Host Controlled</option>';
    audioStatusText.textContent = 'Audio: Managed by Stream Host';
    audioPickerPill.classList.remove('multi-track');
  }

  function playDirectStream(streamUrl, referer = '') {
    embedPlayerBox.classList.remove('active');
    nativePlayerBox.classList.add('active');
    embedIframe.src = '';

    const proxiedUrl = `http://127.0.0.1:3000/api/proxy/hls?url=${encodeURIComponent(streamUrl)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}`;

    if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
      if (hlsInstance) hlsInstance.destroy();

      hlsInstance = new Hls({
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

      hlsInstance.loadSource(proxiedUrl);
      hlsInstance.attachMedia(nativeVideo);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        nativeVideo.play().catch(e => console.warn(e));
        showToast('▶ Playing direct ad-free stream', 'success');
      });

      // Multi-Audio Tracks Resolution & Selection
      hlsInstance.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
        const tracks = data.audioTracks || hlsInstance.audioTracks || [];
        populateAudioTracks(tracks);
      });

      hlsInstance.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
        const tracks = hlsInstance.audioTracks || [];
        const track = tracks[data.id];
        if (track) {
          const trackLabel = formatAudioTrackName(track, data.id);
          showToast(`Audio Track: ${trackLabel}`, 'info');
          audioStatusText.textContent = `Audio: ${trackLabel}`;
          audioTrackDropdown.value = data.id;
        }
      });

      // Auto-Next on Stream End
      nativeVideo.onended = () => {
        if (checkAutoNext.checked && mediaType === 'tv') {
          triggerNextEpisode();
        }
      };

    } else {
      nativeVideo.src = streamUrl;
      nativeVideo.play().catch(e => console.warn(e));
    }
  }

  function formatAudioTrackName(track, id) {
    if (!track) return `Track ${id + 1}`;
    let name = (track.name || '').trim();
    let lang = (track.lang || '').toLowerCase();

    // Friendly Anime & Cinema Audio Naming
    if (lang === 'ja' || lang === 'jpn' || name.toLowerCase().includes('jap') || name.toLowerCase().includes('original')) {
      return 'Japanese (Original)';
    }
    if (lang === 'en' || lang === 'eng' || name.toLowerCase().includes('eng') || name.toLowerCase().includes('dub')) {
      return 'English (Dub)';
    }
    if (lang === 'es' || lang === 'spa') return 'Spanish';
    if (lang === 'fr' || lang === 'fra') return 'French';
    if (lang === 'de' || lang === 'deu') return 'German';
    if (lang === 'pt' || lang === 'por') return 'Portuguese';
    if (lang === 'it' || lang === 'ita') return 'Italian';
    if (lang === 'ru' || lang === 'rus') return 'Russian';
    if (lang === 'ko' || lang === 'kor') return 'Korean';
    if (lang === 'zh' || lang === 'chi' || lang === 'zho') return 'Chinese';

    return name || lang.toUpperCase() || `Audio Track ${id + 1}`;
  }

  function populateAudioTracks(tracks) {
    audioTrackDropdown.innerHTML = '';

    if (!tracks || tracks.length === 0) {
      const opt = document.createElement('option');
      opt.value = '-1';
      opt.textContent = 'Audio: Default';
      audioTrackDropdown.appendChild(opt);
      audioStatusText.textContent = 'Audio: Default (Stereo)';
      audioPickerPill.classList.remove('multi-track');
      return;
    }

    tracks.forEach((track, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `Audio: ${formatAudioTrackName(track, idx)}`;
      if (idx === hlsInstance.audioTrack) opt.selected = true;
      audioTrackDropdown.appendChild(opt);
    });

    if (tracks.length > 1) {
      audioPickerPill.classList.add('multi-track');
      const langs = tracks.map(t => (t.lang || t.name || '').substring(0, 3).toUpperCase()).filter(Boolean);
      audioStatusText.textContent = `Audio: Multi-Track [${langs.join('/')}]`;
      showToast(`Multiple audio tracks detected (${tracks.length})`, 'info');
    } else {
      audioPickerPill.classList.remove('multi-track');
      audioStatusText.textContent = `Audio: ${formatAudioTrackName(tracks[0], 0)}`;
    }

    audioTrackDropdown.onchange = (e) => {
      const chosenIdx = parseInt(e.target.value, 10);
      if (hlsInstance && chosenIdx >= 0) {
        hlsInstance.audioTrack = chosenIdx;
      }
    };
  }

  // 4. MovieBox TV Series Navigation
  async function setupTvSeriesUI() {
    tvEpisodesPanel.classList.remove('hidden');
    btnPrevEp.classList.remove('hidden');
    btnNextEp.classList.remove('hidden');

    seasonPicker.innerHTML = '';
    const validSeasons = (mediaDetails.seasons || []).filter(s => s.season_number > 0);

    validSeasons.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.season_number;
      opt.textContent = `Season ${s.season_number < 10 ? '0' + s.season_number : s.season_number}`;
      if (s.season_number === currentSeason) opt.selected = true;
      seasonPicker.appendChild(opt);
    });

    seasonPicker.onchange = (e) => {
      currentSeason = parseInt(e.target.value, 10);
      currentEpisode = 1;
      updateUrlParams();
      loadSeasonEpisodeMatrix(currentSeason);
      loadStreams(currentSeason, currentEpisode);
    };

    await loadSeasonEpisodeMatrix(currentSeason);
    updateEpisodeButtons();
  }

  async function loadSeasonEpisodeMatrix(seasonNum) {
    movieboxTileMatrix.innerHTML = '<div class="loading-spinner"><i class="ph ph-spinner ph-spin"></i></div>';

    try {
      const res = await API.getSeason(mediaId, seasonNum);
      if (res.success && res.data && res.data.episodes) {
        currentSeasonEpisodes = res.data.episodes;
        episodesCountText.textContent = `${currentSeasonEpisodes.length} Episodes`;
        renderMovieboxTileMatrix(currentSeasonEpisodes);
      }
    } catch (e) {
      movieboxTileMatrix.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">Could not load episodes.</div>';
    }
  }

  function renderMovieboxTileMatrix(episodes) {
    movieboxTileMatrix.innerHTML = '';

    episodes.forEach(ep => {
      const epNum = ep.episode_number;
      const isCurrent = epNum === currentEpisode;
      const numString = epNum < 10 ? `0${epNum}` : `${epNum}`;

      const tile = document.createElement('button');
      tile.className = `moviebox-tile ${isCurrent ? 'active' : ''}`;
      tile.dataset.episode = epNum;
      tile.title = `Episode ${epNum}: ${ep.name || ''}`;

      if (isCurrent) {
        tile.innerHTML = `
          <div class="playing-equalizer">
            <span></span><span></span><span></span>
          </div>
          <span class="ep-num">${numString}</span>
        `;
      } else {
        tile.innerHTML = `<span class="ep-num">${numString}</span>`;
      }

      tile.onclick = () => {
        if (currentEpisode === epNum) return;
        currentEpisode = epNum;
        updateUrlParams();
        renderMovieboxTileMatrix(currentSeasonEpisodes);
        updateEpisodeButtons();
        loadStreams(currentSeason, currentEpisode);
      };

      movieboxTileMatrix.appendChild(tile);
    });
  }

  function updateEpisodeButtons() {
    btnPrevEp.disabled = currentEpisode <= 1;
    btnNextEp.disabled = currentEpisode >= currentSeasonEpisodes.length;

    btnPrevEp.onclick = () => {
      if (currentEpisode > 1) {
        currentEpisode--;
        updateUrlParams();
        renderMovieboxTileMatrix(currentSeasonEpisodes);
        updateEpisodeButtons();
        loadStreams(currentSeason, currentEpisode);
      }
    };

    btnNextEp.onclick = () => triggerNextEpisode();
  }

  function triggerNextEpisode() {
    if (currentEpisode < currentSeasonEpisodes.length) {
      currentEpisode++;
      updateUrlParams();
      renderMovieboxTileMatrix(currentSeasonEpisodes);
      updateEpisodeButtons();
      loadStreams(currentSeason, currentEpisode);
      showToast(`Auto-playing Episode ${currentEpisode}`, 'info');
    }
  }

  function updateUrlParams() {
    const url = new URL(window.location);
    url.searchParams.set('type', mediaType);
    url.searchParams.set('id', mediaId);
    if (mediaType === 'tv') {
      url.searchParams.set('season', currentSeason);
      url.searchParams.set('episode', currentEpisode);
    }
    window.history.replaceState({}, '', url);
  }

  // 5. In-App Trailer Modal
  function openTrailer(ytKey) {
    trailerIframe.src = `https://www.youtube-nocookie.com/embed/${ytKey}?autoplay=1&rel=0`;
    trailerModal.classList.remove('hidden');
  }

  trailerModalClose.onclick = () => {
    trailerModal.classList.add('hidden');
    trailerIframe.src = '';
  };

  // 6. Recommendations
  function loadRecommendations(list) {
    const container = document.getElementById('mini-recommendations-list');
    container.innerHTML = '';

    const items = list.slice(0, 6);
    if (items.length === 0) {
      container.innerHTML = '<span style="color: var(--text-muted); font-size: 13px;">No similar titles found.</span>';
      return;
    }

    items.forEach(item => {
      const title = item.title || item.name;
      const poster = item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=185&q=80';
      const mType = item.media_type || (item.title ? 'movie' : 'tv');

      const card = document.createElement('a');
      card.className = 'mini-rec-card';
      card.href = `/watch.html?type=${mType}&id=${item.id}`;
      card.innerHTML = `
        <img src="${poster}" alt="${title}" class="mini-rec-poster">
        <div class="mini-rec-info">
          <h5>${title}</h5>
          <span><i class="ph-fill ph-star"></i> ${item.vote_average ? item.vote_average.toFixed(1) : 'NR'}</span>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // 7. Watchlist Toggle
  function updateWatchlistBtn() {
    if (!mediaDetails) return;
    const inList = State.isInWatchlist(mediaDetails.id);
    btnWatchlist.innerHTML = inList
      ? '<i class="ph-fill ph-check"></i> In Watchlist'
      : '<i class="ph ph-bookmark-simple"></i> Add to Watchlist';

    btnWatchlist.onclick = () => {
      const added = State.toggleWatchlist(mediaDetails);
      btnWatchlist.innerHTML = added
        ? '<i class="ph-fill ph-check"></i> In Watchlist'
        : '<i class="ph ph-bookmark-simple"></i> Add to Watchlist';
      showToast(added ? 'Added to Watchlist' : 'Removed from Watchlist', 'success');
    };
  }

  // 8. Server Modal Handlers
  btnOpenServerModal.onclick = () => serverModal.classList.remove('hidden');
  serverModalClose.onclick = () => serverModal.classList.add('hidden');
  btnReloadStream.onclick = () => loadStreams(currentSeason, currentEpisode);

  // 9. Focus Mode Toggle
  btnTheaterFocus.onclick = () => {
    document.body.classList.toggle('theater-focus');
    showToast('Cinema Focus Mode Toggled', 'info');
  };

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      serverModal.classList.add('hidden');
      trailerModal.classList.add('hidden');
      trailerIframe.src = '';
    }
  });

  // Track safe navigation
  document.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => { isUserNavigating = true; });
  });

  // Init
  setupAntiRedirectGuard();
  await loadMediaDetails();
  await loadStreams();
});
