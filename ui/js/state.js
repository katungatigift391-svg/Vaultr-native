/**
 * Local State & Storage Manager
 */
const State = {
  KEYS: {
    WATCHLIST: 'vaultr_watchlist',
    CONTINUE_WATCHING: 'vaultr_continue_watching',
    HISTORY: 'vaultr_history',
    SETTINGS: 'vaultr_settings'
  },

  // Get Watchlist
  getWatchlist() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.WATCHLIST)) || [];
    } catch {
      return [];
    }
  },

  // Toggle in Watchlist
  toggleWatchlist(item) {
    const list = this.getWatchlist();
    const index = list.findIndex(i => i.id === item.id && i.media_type === item.media_type);

    let added = false;
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.unshift({
        id: item.id,
        title: item.title || item.name,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        media_type: item.media_type || (item.title ? 'movie' : 'tv'),
        vote_average: item.vote_average,
        release_date: item.release_date || item.first_air_date,
        addedAt: Date.now()
      });
      added = true;
    }

    localStorage.setItem(this.KEYS.WATCHLIST, JSON.stringify(list));
    return added;
  },

  isInWatchlist(id) {
    return this.getWatchlist().some(i => i.id === id);
  },

  // Continue Watching / History
  saveProgress(media) {
    try {
      const list = this.getContinueWatching();
      const filtered = list.filter(i => !(i.id === media.id && i.season === media.season && i.episode === media.episode));
      
      filtered.unshift({
        id: media.id,
        title: media.title,
        poster_path: media.poster_path,
        backdrop_path: media.backdrop_path,
        media_type: media.media_type,
        season: media.season || 1,
        episode: media.episode || 1,
        currentTime: media.currentTime || 0,
        duration: media.duration || 0,
        updatedAt: Date.now()
      });

      // Keep max 20 items in continue watching
      const capped = filtered.slice(0, 20);
      localStorage.setItem(this.KEYS.CONTINUE_WATCHING, JSON.stringify(capped));
    } catch (e) {
      console.error('Error saving progress:', e);
    }
  },

  getContinueWatching() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.CONTINUE_WATCHING)) || [];
    } catch {
      return [];
    }
  },

  clearAllData() {
    localStorage.removeItem(this.KEYS.WATCHLIST);
    localStorage.removeItem(this.KEYS.CONTINUE_WATCHING);
    localStorage.removeItem(this.KEYS.HISTORY);
  }
};
