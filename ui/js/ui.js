/**
 * UI Rendering & Modal Handlers
 */
const UI = {
  IMAGE_BASE: 'https://image.tmdb.org/t/p',

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
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
  },

  createMediaCard(item) {
    const card = document.createElement('div');
    card.className = 'media-card';
    
    const title = item.title || item.name || 'Untitled';
    const year = (item.release_date || item.first_air_date || '').substring(0, 4) || 'N/A';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
    const poster = item.poster_path ? `${this.IMAGE_BASE}/w500${item.poster_path}` : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80';
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');

    card.innerHTML = `
      <img src="${poster}" alt="${title}" class="media-card-poster" loading="lazy">
      <div class="media-card-overlay">
        <a href="watch.html?type=${mediaType}&id=${item.id}${mediaType === 'tv' ? '&season=1&episode=1' : ''}" class="card-play-btn" title="Watch in Theater">
          <i class="ph-fill ph-play"></i>
        </a>
      </div>
      <div class="media-card-info">
        <h4 class="media-card-title">${title}</h4>
        <div class="media-card-sub">
          <span>${year}</span>
          <span class="rating-badge-sm"><i class="ph-fill ph-star"></i> ${rating}</span>
        </div>
      </div>
    `;

    // Click event on card opens details modal
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-play-btn')) {
        return; // Let standard link navigation proceed to watch.html
      }
      UI.openDetailsModal(mediaType, item.id);
    });

    return card;
  },

  renderCarousel(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!items || items.length === 0) {
      container.innerHTML = '<div class="no-items">No items found</div>';
      return;
    }

    items.forEach(item => {
      container.appendChild(this.createMediaCard(item));
    });
  },

  renderGrid(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!items || items.length === 0) {
      container.innerHTML = '<div class="no-items" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No titles found.</div>';
      return;
    }

    items.forEach(item => {
      container.appendChild(this.createMediaCard(item));
    });
  },

  // In-App Trailer Modal
  openTrailerModal(ytKey) {
    const modal = document.getElementById('trailer-modal');
    const iframe = document.getElementById('trailer-iframe');
    if (!modal || !iframe) return;

    iframe.src = `https://www.youtube-nocookie.com/embed/${ytKey}?autoplay=1&rel=0`;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const closeBtn = document.getElementById('trailer-modal-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.classList.add('hidden');
        iframe.src = '';
        document.body.style.overflow = '';
      };
    }
  },

  async openDetailsModal(type, id) {
    const modal = document.getElementById('details-modal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const backdropEl = document.getElementById('modal-backdrop');
    const titleEl = document.getElementById('modal-title');
    const ratingEl = document.getElementById('modal-rating');
    const yearEl = document.getElementById('modal-year');
    const runtimeEl = document.getElementById('modal-runtime');
    const typeTagEl = document.getElementById('modal-type-tag');
    const synopsisEl = document.getElementById('modal-synopsis');
    const genresListEl = document.getElementById('modal-genres-list');
    const trailerBtn = document.getElementById('modal-trailer-btn');
    const playBtn = document.getElementById('modal-play-btn');
    const watchlistBtn = document.getElementById('modal-watchlist-btn');
    const tvNavigator = document.getElementById('tv-series-navigator');
    const statusEl = document.getElementById('info-status');
    const langEl = document.getElementById('info-lang');
    const castEl = document.getElementById('info-cast');

    titleEl.textContent = 'Loading...';
    synopsisEl.textContent = '';
    genresListEl.innerHTML = '';
    castEl.textContent = '...';

    try {
      const res = await API.getDetails(type, id);
      if (!res.success || !res.data) throw new Error('Could not load details');

      const data = res.data;
      const title = data.title || data.name;
      const releaseDate = data.release_date || data.first_air_date || '';
      const year = releaseDate.substring(0, 4) || 'N/A';
      const rating = data.vote_average ? data.vote_average.toFixed(1) : 'NR';
      const runtime = data.runtime ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m` : (data.episode_run_time?.[0] ? `${data.episode_run_time[0]}m` : 'TV Series');

      titleEl.textContent = title;
      ratingEl.innerHTML = `<i class="ph-fill ph-star"></i> ${rating}`;
      yearEl.textContent = year;
      runtimeEl.textContent = runtime;
      typeTagEl.textContent = type.toUpperCase();
      synopsisEl.textContent = data.overview || 'No description available for this title.';
      statusEl.textContent = data.status || 'Released';
      langEl.textContent = (data.original_language || 'en').toUpperCase();

      if (data.backdrop_path) {
        backdropEl.src = `${this.IMAGE_BASE}/w1280${data.backdrop_path}`;
      } else if (data.poster_path) {
        backdropEl.src = `${this.IMAGE_BASE}/w780${data.poster_path}`;
      }

      // Render genres
      genresListEl.innerHTML = '';
      (data.genres || []).forEach(g => {
        const badge = document.createElement('span');
        badge.className = 'genre-badge';
        badge.textContent = g.name;
        genresListEl.appendChild(badge);
      });

      // Render top cast
      const castNames = (data.credits?.cast || []).slice(0, 5).map(c => c.name).join(', ');
      castEl.textContent = castNames || 'N/A';

      // In-App Trailer Player
      const trailer = data.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      if (trailer) {
        trailerBtn.classList.remove('hidden');
        trailerBtn.onclick = () => {
          UI.openTrailerModal(trailer.key);
        };
      } else {
        trailerBtn.classList.add('hidden');
      }

      // Watchlist Button State
      const isInList = State.isInWatchlist(data.id);
      watchlistBtn.innerHTML = isInList 
        ? '<i class="ph-fill ph-check"></i> In Watchlist' 
        : '<i class="ph ph-bookmark-simple"></i> Add to Watchlist';

      watchlistBtn.onclick = () => {
        const added = State.toggleWatchlist(data);
        watchlistBtn.innerHTML = added 
          ? '<i class="ph-fill ph-check"></i> In Watchlist' 
          : '<i class="ph ph-bookmark-simple"></i> Add to Watchlist';
        UI.showToast(added ? 'Added to Watchlist' : 'Removed from Watchlist', 'success');
      };

      // Play button opens dedicated watch page
      playBtn.onclick = () => {
        window.location.href = `watch.html?type=${type}&id=${data.id}${type === 'tv' ? '&season=1&episode=1' : ''}`;
      };

      // TV Series Seasons & Episodes
      if (type === 'tv' && data.seasons && data.seasons.length > 0) {
        tvNavigator.classList.remove('hidden');
        const seasonSelect = document.getElementById('season-selector');
        seasonSelect.innerHTML = '';

        const validSeasons = data.seasons.filter(s => s.season_number > 0);
        validSeasons.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.season_number;
          opt.textContent = `Season ${s.season_number} (${s.episode_count} Episodes)`;
          seasonSelect.appendChild(opt);
        });

        const loadSeasonEpisodes = async (seasonNum) => {
          const epGrid = document.getElementById('episodes-grid');
          epGrid.innerHTML = '<div class="loading-spinner"><i class="ph ph-spinner ph-spin"></i></div>';
          
          try {
            const seasonData = await API.getSeason(data.id, seasonNum);
            epGrid.innerHTML = '';
            
            if (seasonData.success && seasonData.data && seasonData.data.episodes) {
              seasonData.data.episodes.forEach(ep => {
                const epCard = document.createElement('div');
                epCard.className = 'episode-card';
                const epThumb = ep.still_path ? `${this.IMAGE_BASE}/w300${ep.still_path}` : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=300&q=80';

                epCard.innerHTML = `
                  <img src="${epThumb}" alt="Ep ${ep.episode_number}" class="episode-thumb" loading="lazy">
                  <div class="episode-info">
                    <span class="episode-num">EPISODE ${ep.episode_number}</span>
                    <h5 class="episode-name">${ep.name || `Episode ${ep.episode_number}`}</h5>
                  </div>
                `;

                epCard.onclick = () => {
                  window.location.href = `watch.html?type=tv&id=${data.id}&season=${seasonNum}&episode=${ep.episode_number}`;
                };

                epGrid.appendChild(epCard);
              });
            }
          } catch (e) {
            epGrid.innerHTML = '<div style="color: var(--text-muted); padding: 12px;">Failed to load episodes.</div>';
          }
        };

        seasonSelect.onchange = (e) => loadSeasonEpisodes(e.target.value);
        if (validSeasons.length > 0) {
          loadSeasonEpisodes(validSeasons[0].season_number);
        }
      } else {
        tvNavigator.classList.add('hidden');
      }

    } catch (err) {
      console.error(err);
      UI.showToast('Failed to fetch media details', 'error');
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }
};
