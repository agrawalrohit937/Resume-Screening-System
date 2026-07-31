// Apply Assistant API — all calls reuse the shared axios instance from api.js
// which handles JWT auth, 401 auto-refresh, and CORS automatically.
import api from './api';

const BASE = '/apply';
const AUTH = '/auth';

export const applyAssistantApi = {
  checkATSScore: (payload) => api.post(`${BASE}/ats-score`, payload).then((r) => r.data),

  generateDraft: (payload) => api.post(`${BASE}/draft`, payload).then((r) => r.data),

  updateDraft: (applicationId, edits) =>
    api.put(`${BASE}/draft/${applicationId}`, edits).then((r) => r.data),

  getDraft: (applicationId) =>
    api.get(`${BASE}/draft/${applicationId}`).then((r) => r.data),

  getActiveDraft: () =>
    api.get(`${BASE}/active-draft`).then((r) => r.data),

  // GET returns a PDF file directly — build the URL for an <a>/<iframe> or
  // trigger a download, rather than parsing it as JSON.
  previewDraftUrl: (applicationId) =>
    `${api.defaults.baseURL}${BASE}/draft/${applicationId}/preview`,

  // ── UPDATED: No longer requires accessToken ──────────────────────────────
  // The backend handles token management (auto-refresh) internally.
  // If Gmail is not connected, the backend returns HTTP 428 — the frontend
  // should redirect the user to connect Gmail first.
  sendApplication: (applicationId) =>
    api.post(`${BASE}/draft/${applicationId}/send`).then((r) => r.data),

  getHistory: (page = 1, pageSize = 20) =>
    api.get(`${BASE}/history`, { params: { page, page_size: pageSize } }).then((r) => r.data),

  // ── Gmail OAuth helpers ──────────────────────────────────────────────────

  /** Check whether the current user has a connected Gmail account.
   *  Returns { is_connected: boolean }
   */
  checkGmailConnected: () =>
    api.get(`${AUTH}/gmail/status`).then((r) => r.data),

  /** Get the Google consent URL from the backend.
   *  Returns { authorize_url: string, already_connected: boolean }
   *  The frontend should redirect the user to authorize_url.
   */
  getGmailAuthorizeUrl: () =>
    api.get(`${AUTH}/gmail/authorize`).then((r) => r.data),

  /** Exchange the authorization code from Google's redirect for stored tokens.
   *  Called by the /gmail-callback page after Google redirects back.
   *  Returns { success: boolean, message: string, expires_at: string }
   */
  exchangeGmailCode: (code, state) =>
    api.post(`${AUTH}/gmail/callback`, { code, state }).then((r) => r.data),

  /** Disconnect (revoke) the user's Gmail authorization. */
  disconnectGmail: () =>
    api.delete(`${AUTH}/gmail/disconnect`).then((r) => r.data),
};

export default applyAssistantApi;
