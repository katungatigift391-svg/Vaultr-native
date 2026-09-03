/**
 * Main Application Orchestrator — Vaultr Platform
 * Handles Navigation, Netflix-style Search, Dynamic TMDB Genre Filters, and Catalog.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const navbar = document.getElementById('navbar');
  const navBtns = document.querySelectorAll('.nav-btn');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchDropdown = document.getElementById('search-results');
  const contentWrapper = document.getElementById('content-wrapper');
  const gridViewWrapper = document.getElementById('grid-view-wrapper');
  const heroSection = document.getElementById('hero-section');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const detailsModal = document.getElementById('details-modal');
  const btnSettings = document.getElementById('btn-settings');
  const settingsModal = document.getElementById('settings-modal');
  const settingsCloseBtn = document.getElementById('settings-close-btn');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnClearCache = document.getElementById('btn-clear-cache');
  const serverStatusText = document.getElementById('server-status-text');

  // Search Page Elements
  const searchViewWrapper = document.getElementById('search-view-wrapper');
  const searchPageInput = document.getElementById('search-page-input');
  const searchPageClear = document.getElementById('search-page-clear');
  const searchResultsGrid = document.getElementById('search-results-grid');
  const searchResultsHeading = document.getElementById('search-results-heading');
  const searchResultsCount = document.getElementById('search-results-count');
  const searchTypePills = document.querySelectorAll('#search-type-pills .pill-chip');
  const searchGenreChips = document.getElementById('search-genre-chips');

  // Filters & State
  const genreFilterSelect = document.getElementById('genre-filter-select');
  const sortFilterSelect = document.getElementById('sort-filter-select');

  let currentView = 'home';
  let currentPage = 1;
  let currentGenre = '';
  let currentSort = 'popularity.desc';
  let searchTimeout = null;
  let searchFilterType = 'all';
  let allGenresList = [];

  // 1. Initial Data Fetch & Boot
  async function initApp() {
    loadContinueWatching();
    loadHeroAndShelves();
    loadGenres();
    checkServerHealth();
  }

  async function checkServerHealth() {
    const health = await API.checkHealth();
    if (health.status === 'online') {
      serverStatusText.textContent = `Online • ${health.platform} (v${health.version})`;
    } else {
      serverStatusText.textContent = 'Offline / Connection Error';
    }
  }

  // Fetch and Populate Dynamic TMDB Genres
  async function loadGenres() {
    try {
      const res = await API.getGenres();
      if (res.success && res.genres) {
        allGenresList = res.genres;

        // 1. Populate Dropdown in Browse View
        genreFilterSelect.innerHTML = '<option value="">All Genres</option>';
        allGenresList.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = g.name;
          genreFilterSelect.appendChild(opt);
        });

        // 2. Populate Search Category Chips
        searchGenreChips.innerHTML = '';
        allGenresList.slice(0, 12).forEach(g => {
          const chip = document.createElement('button');
          chip.className = 'genre-chip-btn';
          chip.textContent = g.name;
          chip.onclick = () => {
            document.querySelectorAll('.genre-chip-btn').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterSearchByGenre(g.id, g.name);
          };
          searchGenreChips.appendChild(chip);
        });
      }
    } catch (e) {
      console.warn('Could not load genres:', e);
    }
  }

  function loadContinueWatching() {
    const continueList = State.getContinueWatching();
    const shelfContinue = document.getElementById('shelf-continue');
    const gridContinue = document.getElementById('grid-continue');

    if (continueList && continueList.length > 0) {
      shelfContinue.classList.remove('hidden');
      gridContinue.innerHTML = '';
      continueList.forEach(item => {
        gridContinue.appendChild(UI.createMediaCard(item));
      });
    } else {
      shelfContinue.classList.add('hidden');
    }
  }

  async function loadHeroAndShelves() {
    try {
      // 1. Trending for Hero & Shelf
      const trendingData = await API.getTrending('all', 'week');
      if (trendingData.success && trendingData.results.length > 0) {
        const featured = trendingData.results[0];
        setupHero(featured);
        UI.renderCarousel('carousel-trending', trendingData.results);
      }

      // 2. Popular Movies
      const moviesData = await API.discover('movie', '', 'popularity.desc');
      if (moviesData.success) {
        UI.renderCarousel('carousel-popular-movies', moviesData.results);
      }

      // 3. Popular TV Shows
      const tvData = await API.discover('tv', '', 'popularity.desc');
      if (tvData.success) {
        UI.renderCarousel('carousel-popular-tv', tvData.results);
      }

      // 4. Action Movies (Genre ID: 28)
      const actionData = await API.discover('movie', '28', 'popularity.desc');
      if (actionData.success) {
        UI.renderCarousel('carousel-genre-action', actionData.results);
      }

      // 5. Sci-Fi (Genre ID: 878)
      const scifiData = await API.discover('movie', '878', 'popularity.desc');
      if (scifiData.success) {
        UI.renderCarousel('carousel-genre-scifi', scifiData.results);
      }

      // 6. Animation / Anime (Genre ID: 16)
      const animData = await API.discover('tv', '16', 'popularity.desc');
      if (animData.success) {
        UI.renderCarousel('carousel-genre-animation', animData.results);
      }

    } catch (err) {
      console.error('Failed to load catalog shelves:', err);
      UI.showToast('Could not load some catalog data', 'error');
    }
  }

  function setupHero(item) {
    const backdrop = document.getElementById('hero-backdrop');
    const title = document.getElementById('hero-title');
    const rating = document.getElementById('hero-rating');
    const year = document.getElementById('hero-year');
    const type = document.getElementById('hero-type');
    const overview = document.getElementById('hero-overview');
    const playBtn = document.getElementById('hero-play-btn');
    const detailsBtn = document.getElementById('hero-details-btn');
    const watchlistBtn = document.getElementById('hero-watchlist-btn');

    const itemTitle = item.title || item.name;
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    const releaseDate = item.release_date || item.first_air_date || '';

    title.textContent = itemTitle;
    rating.innerHTML = `<i class="ph-fill ph-star"></i> ${item.vote_average ? item.vote_average.toFixed(1) : '8.5'}`;
    year.textContent = releaseDate.substring(0, 4) || '2024';
    type.textContent = mediaType.toUpperCase();
    overview.textContent = item.overview || 'Explore cinema streams with multi-source backup resolvers.';

    if (item.backdrop_path) {
      backdrop.style.backgroundImage = `url(https://image.tmdb.org/t/p/original${item.backdrop_path})`;
    }

    // Hero Play navigates to dedicated watch page
    playBtn.onclick = () => {
      window.location.href = `watch.html?type=${mediaType}&id=${item.id}${mediaType === 'tv' ? '&season=1&episode=1' : ''}`;
    };

    detailsBtn.onclick = () => {
      UI.openDetailsModal(mediaType, item.id);
    };

    watchlistBtn.onclick = () => {
      const added = State.toggleWatchlist(item);
      watchlistBtn.innerHTML = added ? '<i class="ph-fill ph-check"></i>' : '<i class="ph ph-plus"></i>';
      UI.showToast(added ? 'Added to Watchlist' : 'Removed from Watchlist', 'success');
    };
  }

  // 2. Navigation & Views Switching
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;
      currentView = view;
      currentPage = 1;
      currentGenre = '';
      genreFilterSelect.value = '';
      switchView(view);
    });
  });

  async function switchView(view) {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Hide all view wrappers first
    heroSection.classList.add('hidden');
    contentWrapper.classList.add('hidden');
    gridViewWrapper.classList.add('hidden');
    searchViewWrapper.classList.add('hidden');

    if (view === 'home') {
      heroSection.classList.remove('hidden');
      contentWrapper.classList.remove('hidden');
      loadContinueWatching();
    } else if (view === 'movies') {
      gridViewWrapper.classList.remove('hidden');
      document.getElementById('view-title').textContent = 'Explore Movies';
      await loadGridView('movie');
    } else if (view === 'tv') {
      gridViewWrapper.classList.remove('hidden');
      document.getElementById('view-title').textContent = 'Explore TV Series';
      await loadGridView('tv');
    } else if (view === 'search') {
      searchViewWrapper.classList.remove('hidden');
      searchPageInput.focus();
      if (!searchPageInput.value.trim()) {
        loadSearchDefaultDiscoveries();
      }
    } else if (view === 'watchlist') {
      gridViewWrapper.classList.remove('hidden');
      document.getElementById('view-title').textContent = 'My Watchlist';
      document.getElementById('pagination-wrapper').classList.add('hidden');
      document.getElementById('view-filters').classList.add('hidden');

      const watchlistItems = State.getWatchlist();
      UI.renderGrid('main-media-grid', watchlistItems);
    }
  }

  async function loadGridView(type) {
    document.getElementById('pagination-wrapper').classList.remove('hidden');
    document.getElementById('view-filters').classList.remove('hidden');
    document.getElementById('page-indicator').textContent = `Page ${currentPage}`;

    const gridEl = document.getElementById('main-media-grid');
    gridEl.innerHTML = '<div class="loading-spinner"><i class="ph ph-spinner ph-spin"></i></div>';

    try {
      const data = await API.discover(type, currentGenre, currentSort, currentPage);
      if (data.success) {
        UI.renderGrid('main-media-grid', data.results);
      }
    } catch (e) {
      gridEl.innerHTML = '<div class="no-items">Failed to load media.</div>';
    }
  }

  // Filter Listeners in Browse View
  genreFilterSelect.addEventListener('change', (e) => {
    currentGenre = e.target.value;
    currentPage = 1;
    loadGridView(currentView === 'movies' ? 'movie' : 'tv');
  });

  sortFilterSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    currentPage = 1;
    loadGridView(currentView === 'movies' ? 'movie' : 'tv');
  });

  // 3. Netflix-Style Dedicated Search
  async function loadSearchDefaultDiscoveries() {
    searchResultsHeading.textContent = 'Trending & Popular Discoveries';
    searchResultsCount.textContent = '';
    searchResultsGrid.innerHTML = '<div class="loading-spinner"><i class="ph ph-spinner ph-spin"></i></div>';

    try {
      const data = await API.getTrending('all', 'day');
      if (data.success) {
        UI.renderGrid('search-results-grid', data.results);
      }
    } catch (e) {
      searchResultsGrid.innerHTML = '<div class="no-items">Failed to load recommendations.</div>';
    }
  }

  searchPageInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchTimeout);

    if (!query) {
      searchPageClear.classList.add('hidden');
      loadSearchDefaultDiscoveries();
      return;
    }

    searchPageClear.classList.remove('hidden');
    searchResultsGrid.innerHTML = '<div class="loading-spinner"><i class="ph ph-spinner ph-spin"></i></div>';

    searchTimeout = setTimeout(async () => {
      executeSearch(query);
    }, 300);
  });

  searchPageClear.addEventListener('click', () => {
    searchPageInput.value = '';
    searchPageClear.classList.add('hidden');
    searchPageInput.focus();
    loadSearchDefaultDiscoveries();
  });

  async function executeSearch(query) {
    try {
      const data = await API.search(query);
      if (data.success && data.results) {
        let results = data.results;
        if (searchFilterType !== 'all') {
          results = results.filter(r => r.media_type === searchFilterType);
        }

        searchResultsHeading.textContent = `Results for "${query}"`;
        searchResultsCount.textContent = `(${results.length} titles)`;
        UI.renderGrid('search-results-grid', results);
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  }

  // Filter Search by Type (All / Movies / TV)
  searchTypePills.forEach(pill => {
    pill.addEventListener('click', () => {
      searchTypePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      searchFilterType = pill.dataset.filter;

      const q = searchPageInput.value.trim();
      if (q) executeSearch(q);
      else loadSearchDefaultDiscoveries();
    });
  });

  // Filter Search by Category Chip
  async function filterSearchByGenre(genreId, genreName) {
    searchResultsHeading.textContent = `${genreName} Collections`;
    searchResultsGrid.innerHTML = '<div class="loading-spinner"><i class="ph ph-spinner ph-spin"></i></div>';

    try {
      const movieData = await API.discover('movie', genreId, 'popularity.desc');
      const tvData = await API.discover('tv', genreId, 'popularity.desc');

      const combined = [
        ...(movieData.results || []).map(r => ({ ...r, media_type: 'movie' })),
        ...(tvData.results || []).map(r => ({ ...r, media_type: 'tv' }))
      ];

      // Shuffle/sort by rating
      combined.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      searchResultsCount.textContent = `(${combined.length} titles)`;
      UI.renderGrid('search-results-grid', combined);
    } catch (e) {
      searchResultsGrid.innerHTML = '<div class="no-items">Failed to filter by category.</div>';
    }
  }

  // Quick Navbar Search Box (Directs to Search View)
  searchInput.addEventListener('focus', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('[data-view="search"]').classList.add('active');
    switchView('search');
    searchPageInput.value = searchInput.value;
    if (searchInput.value.trim()) {
      executeSearch(searchInput.value.trim());
    }
  });

  // 4. Modals and Settings Handlers
  modalCloseBtn.addEventListener('click', () => {
    detailsModal.classList.add('hidden');
    document.body.style.overflow = '';
  });

  btnSettings.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    checkServerHealth();
  });

  settingsCloseBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    document.body.style.overflow = '';
  });

  btnSaveSettings.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    document.body.style.overflow = '';
    UI.showToast('Settings saved successfully', 'success');
  });

  btnClearCache.addEventListener('click', () => {
    State.clearAllData();
    UI.showToast('Watch history and watchlist cleared', 'success');
    loadContinueWatching();
  });

  // 5. Pagination
  document.getElementById('btn-prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadGridView(currentView === 'movies' ? 'movie' : 'tv');
    }
  });

  document.getElementById('btn-next-page').addEventListener('click', () => {
    currentPage++;
    loadGridView(currentView === 'movies' ? 'movie' : 'tv');
  });

  // Shelf Tabs (Trending All / Movie / TV)
  document.querySelectorAll('.shelf-tabs .tab-pill').forEach(pill => {
    pill.addEventListener('click', async () => {
      document.querySelectorAll('.shelf-tabs .tab-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const type = pill.dataset.type;

      const carousel = document.getElementById('carousel-trending');
      carousel.innerHTML = '<div class="loading-spinner"><i class="ph ph-spinner ph-spin"></i></div>';

      const res = await API.getTrending(type, 'week');
      if (res.success) {
        UI.renderCarousel('carousel-trending', res.results);
      }
    });
  });

  // Navbar scroll background effect
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.style.background = 'rgba(8, 9, 12, 0.95)';
    } else {
      navbar.style.background = 'linear-gradient(180deg, rgba(8, 9, 12, 0.95) 0%, rgba(8, 9, 12, 0.6) 70%, transparent 100%)';
    }
  });

  // Start app
  initApp();
});
