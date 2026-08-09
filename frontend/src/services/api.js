import axios from 'axios'

// [BUG-005] Use the env var in production, fall back to a relative path so the
// Vite proxy (vite.config.js → proxy: '/api' → 'http://localhost:8000') handles
// routing in development without hardcoding localhost.
const BASE = import.meta.env.VITE_API_URL || '/api/v1'

// ✅ Create instance
const api = axios.create({
  baseURL: BASE,
  timeout: 120000,  // Increased for PDF generation (2min)
  withCredentials: false // JWT use ho raha hai → cookies ki need nahi
})

// REQUEST INTERCEPTOR (TOKEN ADD)
api.interceptors.request.use((config) => {
  // 1. localStorage (primary)
  let token = localStorage.getItem("access_token");

  // 2. Fallback: Cookie (httponly support)
  if (!token) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'access_token') {
        token = value;
        break;
      }
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    // Only warn for requests that expect authentication (exclude public/auth endpoints)
    const isPublic = ['/auth/login', '/auth/signup', '/auth/google', '/auth/github', '/auth/linkedin', '/auth/otp', '/health'].some(path => config.url?.includes(path));
    if (!isPublic) {
      console.warn('[API] No token found for:', config.url);
    }
  }

  return config;
}, (error) => {
  console.error('[API] Request setup error:', error);
  return Promise.reject(error);
});


// RESPONSE INTERCEPTOR (AUTO REFRESH + DEBUG)

api.interceptors.response.use(
  (response) => response,

  async (err) => {
    const originalRequest = err.config;

    // ===== DEBUG LOGS =====
    if (!originalRequest?.suppressErrorLog) {
      console.group("[API ERROR]");
      console.log("URL:", originalRequest?.url);
      console.log("Method:", originalRequest?.method);
      console.log("Status:", err.response?.status);
      console.log(
        "Response Data:",
        JSON.stringify(err.response?.data, null, 2)
      );
      console.log("Full Error:", err);
      console.groupEnd();
    }

    // ===== REFRESH ONLY FOR 401 =====
    // Endpoints that MUST NOT attempt refresh on 401 (e.g. login, refresh itself, OAuth initiation)
    const nonRefreshable = ['/auth/login', '/auth/refresh', '/auth/signup', '/auth/otp', '/auth/google', '/auth/github', '/auth/linkedin'];
    const isNonRefreshable = nonRefreshable.some(path => originalRequest?.url?.includes(path));

    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      !isNonRefreshable
    ) {
      originalRequest._retry = true;

      console.log("[API] 401 detected. Refreshing token...");

      try {
        const refreshToken = localStorage.getItem("refresh_token");

        if (!refreshToken) {
          console.error("[API] No refresh token found.");

          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");

          window.location.href = "/login";
          return Promise.reject(err);
        }

        const response = await axios.post(
          `${BASE}/auth/refresh`,
          {
            refresh_token: refreshToken,
          },
          {
            timeout: 10000,
          }
        );

        const newAccessToken = response.data.access_token;

        localStorage.setItem("access_token", newAccessToken);

        if (response.data.refresh_token) {
          localStorage.setItem(
            "refresh_token",
            response.data.refresh_token
          );
        }

        originalRequest.headers.Authorization =
          `Bearer ${newAccessToken}`;

        console.log("[API] Token refreshed successfully.");

        return api(originalRequest);

      } catch (refreshError) {

        console.error(
          "[API] Refresh failed:",
          refreshError.response?.data || refreshError.message
        );

        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");

        window.location.href = "/login?reason=auth_expired";

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(err);
  }
);


// API FUNCTIONS

export const uploadResume = (file, onProgress) => {
  const f = new FormData()
  f.append('file', file)

  return api.post('/resume/upload', f, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e =>
      onProgress?.(Math.round((e.loaded * 100) / e.total))
  })
}

export const getResumes = (p, config) => api.get('/resume/', { params: p, ...config })

export const deleteResume = (id) => api.delete(`/resume/${id}`)

export const reparseResume = (id) => api.post(`/resume/${id}/reparse`)

export const matchATS = (p) => api.post('/ats/match', p)

export const getATSHistory = (p, config) => api.get('/ats/history', { params: p, ...config })

export const getATSResult = (id) => api.get(`/ats/result/${id}`)

export const enhanceResume = (p) => api.post('enhance/enhance-and-download', p)

export const generateInterview = (p) => api.post('/interview/generate', p)

export const analyzeGitHub = (p) => api.post('/github/analyze', p)

export const generatePDF = (p) => api.post('/pdf/generate', p)

export const getMyAnalytics = (p, config) =>
  api.get('/analytics/me', { params: p, ...config })


export const getSkillsMarket = () =>
  api.get('/analytics/skills-market')

// Recruiter APIs (NEW)
export const searchCandidates = (payload) => api.post('/recruiter/search', payload)
export const getCandidateDetail = (id) => api.get(`/recruiter/candidate/${id}`)
export const downloadResume = (id) => api.get(`/recruiter/resume/${id}/download`, {
  responseType: 'blob'
})

export const matchJD = async (data) => {
  try {
    console.log("[Recruiter] Sending JD:", data);

    const res = await api.post("/recruiter/v2/match-jd", data);

    console.log("[Recruiter] Response:", res.data);

    return res.data;
  } catch (err) {
    console.error("[Recruiter] ERROR:", err.response?.data || err.message);
    throw err;
  }
};

export const setPrimaryResume = (payload) =>
  api.put('/users/me/set-primary-resume', payload)

export const chatCopilotStream = async (message, history = [], quickAction = null, forceRefresh = false) => {
  let token = localStorage.getItem("access_token");
  if (!token) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'access_token') {
        token = value;
        break;
      }
    }
  }

  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE}/copilot/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      history,
      quick_action: quickAction,
      force_refresh: forceRefresh,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || 'Failed to connect to AI Copilot.');
  }

  return response;
};

export default api