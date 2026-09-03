/**
 * Vaultr Client API Gateway
 */
const API = {
  // TMDB Endpoints
  async getTrending(type = 'all', timeWindow = 'week', page = 1) {
    const res = await fetch(`/api/tmdb/trending/${type}/${timeWindow}?page=${page}`);
    return await res.json();
  },

  async discover(type = 'movie', genre = '', sortBy = 'popularity.desc', page = 1) {
    let url = `/api/tmdb/discover/${type}?sort_by=${sortBy}&page=${page}`;
    if (genre) url += `&genre=${genre}`;
    const res = await fetch(url);
    return await res.json();
  },

  async search(query, page = 1) {
    const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}&page=${page}`);
    return await res.json();
  },

  async getDetails(type, id) {
    const res = await fetch(`/api/tmdb/details/${type}/${id}`);
    return await res.json();
  },

  async getSeason(id, seasonNumber) {
    const res = await fetch(`/api/tmdb/tv/${id}/season/${seasonNumber}`);
    return await res.json();
  },

  async getGenres() {
    const res = await fetch('/api/tmdb/genres');
    return await res.json();
  },

  // Stream Resolver Endpoint
  async resolveStreams(type, id, season = 1, episode = 1) {
    const url = `/api/stream/resolve?type=${type}&id=${id}&season=${season}&episode=${episode}`;
    const res = await fetch(url);
    return await res.json();
  },

  // Health check
  async checkHealth() {
    try {
      const res = await fetch('/api/health');
      return await res.json();
    } catch (e) {
      return { status: 'offline' };
    }
  }
};
