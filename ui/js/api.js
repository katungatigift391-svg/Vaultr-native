/**
 * Vaultr Client API Gateway — Native Tauri IPC Bridge
 */
const API = {
  async _invoke(cmd, args = {}) {
    if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
      return await window.__TAURI__.core.invoke(cmd, args);
    }
    // Brief retry tick in case document scripts run slightly ahead of injection
    await new Promise(r => setTimeout(r, 60));
    if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
      return await window.__TAURI__.core.invoke(cmd, args);
    }
    console.error('Tauri IPC is not initialized on window.__TAURI__');
    throw new Error('Tauri native IPC not available');
  },

  async tmdb(endpoint, params = {}) {
    const paramPairs = Object.entries(params).map(([k, v]) => [k, String(v)]);
    return await this._invoke('tmdb_get', { endpoint, params: paramPairs });
  },

  // TMDB Endpoints
  async getTrending(type = 'all', timeWindow = 'week', page = 1) {
    return await this.tmdb(`/trending/${type}/${timeWindow}`, { page });
  },

  async discover(type = 'movie', genre = '', sortBy = 'popularity.desc', page = 1) {
    const params = { sort_by: sortBy, page };
    if (genre) params.genre = genre;
    return await this.tmdb(`/discover/${type}`, params);
  },

  async search(query, page = 1) {
    return await this.tmdb('/search/multi', { q: query, page });
  },

  async getDetails(type, id) {
    const raw = await this.tmdb(`/${type}/${id}`, { append_to_response: 'videos,credits,similar,recommendations' });
    return { success: true, data: raw, ...raw };
  },

  async getSeason(id, seasonNumber) {
    const raw = await this.tmdb(`/tv/${id}/season/${seasonNumber}`);
    return { success: true, data: raw, ...raw };
  },

  async getGenres() {
    return await this.tmdb('/genre/movie/list');
  },

  // Native Stream Resolver Endpoint
  async resolveStreams(type, id, season = 1, episode = 1) {
    const res = await this._invoke('resolve_streams', {
      mediaType: type,
      id: String(id),
      season: String(season),
      episode: String(episode)
    });

    const sources = res?.sources || [];
    const primaryEmbed = sources.length > 0 ? sources[0].url : (
      type === 'tv'
        ? `https://vidlink.pro/tv/${id}/${season}/${episode}`
        : `https://vidlink.pro/movie/${id}`
    );
    const dataObj = {
      mediaType: type,
      id: String(id),
      season: Number(season),
      episode: Number(episode),
      primaryEmbed,
      activeSources: sources,
      sources
    };

    return {
      success: true,
      data: dataObj,
      ...dataObj
    };
  },

  // Health check
  async checkHealth() {
    return { status: 'online', platform: 'Vaultr Native (IPC)', version: '2.0.0' };
  }
};
