const BASE_URL = 'http://localhost:3000/api';

/**
 * Wrapper fetch centralisé.
 * Envoie les cookies de session (credentials: 'include').
 * Lève une Error si la réponse n'est pas 2xx.
 */
export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(err.error || 'Erreur réseau');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export const api = {
  // Auth
  login: (handle) => apiFetch('/auth/login', { method: 'POST', body: { handle } }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  me: () => apiFetch('/auth/me'),

  // Cards
  getCards: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiFetch(`/cards${params ? '?' + params : ''}`);
  },
  getCard: (id) => apiFetch(`/cards/${id}`),
  getTradesByCard: (cardId) => apiFetch(`/cards/${cardId}/trades`),

  // Trades
  createTrade: (data) => apiFetch('/trades', { method: 'POST', body: data }),
  getTrades: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiFetch(`/trades${params ? '?' + params : ''}`);
  },
  getTrade: (id) => apiFetch(`/trades/${id}`),
  acceptTrade: (id) => apiFetch(`/trades/${id}/accept`, { method: 'POST' }),
  refuseTrade: (id) => apiFetch(`/trades/${id}/refuse`, { method: 'POST' }),
  counterTrade: (id, data) => apiFetch(`/trades/${id}/counter`, { method: 'POST', body: data }),
  cancelTrade: (id) => apiFetch(`/trades/${id}/cancel`, { method: 'POST' }),

  // Messages
  getMessages: (tradeId) => apiFetch(`/trades/${tradeId}/messages`),
  addMessage: (tradeId, body) =>
    apiFetch(`/trades/${tradeId}/messages`, { method: 'POST', body: { body } }),

  // Images (proxy public vers les APIs TCG)
  async getCardImage(game, name) {
    try {
      const r = await fetch(
        `/api/images/card?game=${encodeURIComponent(game)}&name=${encodeURIComponent(name)}`
      );
      if (!r.ok) return null;
      const { imageUrl } = await r.json();
      return imageUrl || null;
    } catch {
      return null;
    }
  },
};
