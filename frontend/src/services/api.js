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

  // 3. Multi-Tenant Enterprise Header (omit for auth endpoints to prevent stale tenant spoofing checks)
  const isAuthRoute = Boolean(config.url && (
    config.url.includes('/auth/') ||
    config.url.startsWith('auth/') ||
    config.url.startsWith('/auth')
  ));

  const tenantId = localStorage.getItem("tenant_id");
  if (!isAuthRoute && tenantId && tenantId !== "default") {
    if (config.headers?.set) {
      config.headers.set('x-tenant-id', tenantId);
    } else if (config.headers) {
      config.headers['x-tenant-id'] = tenantId;
    }
  } else {
    if (config.headers?.delete) {
      config.headers.delete('x-tenant-id');
    } else if (config.headers) {
      delete config.headers['x-tenant-id'];
    }
  }

  if (token) {
    if (config.headers?.set) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else if (config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
      config.headers['Authorization'] = `Bearer ${token}`;
    }
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

    // List of auth-check / non-refreshable endpoints where 401 is normal (e.g., /auth/me on unauthenticated landing)
    // and should NEVER trigger token refresh or hard redirects.
    const isNonRefreshable =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/logout') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/verify-email') ||
      originalRequest?.url?.includes('/auth/forgot-password') ||
      originalRequest?.url?.includes('/auth/reset-password');

    // 🔄 AUTOMATIC REFRESH ON 401 (for all protected data routes)
    if (
      err.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isNonRefreshable
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refresh_token");

        if (!refreshToken) {
          clearLocalAuth();

          // CRITICAL FIX: Never execute window.location.href hard reloads for /auth/me
          // or when already on /login or public landing pages! Hard reloads force
          // AuthContext to remount, call /auth/me, get 401, and reload in an infinite loop.
          const isAuthMe = originalRequest?.url?.includes('/auth/me');
          const isAlreadyOnLogin = typeof window !== 'undefined' && window.location.pathname === '/login';

          if (!isAuthMe && !isAlreadyOnLogin) {
            window.location.href = "/login";
          }
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

        if (originalRequest.headers?.set) {
          originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
        } else if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        }

        return api(originalRequest);

      } catch (refreshError) {
        clearLocalAuth();

        const isAuthMe = originalRequest?.url?.includes('/auth/me');
        const isAlreadyOnLogin = typeof window !== 'undefined' && window.location.pathname === '/login';

        if (!isAuthMe && !isAlreadyOnLogin) {
          window.location.href = "/login?reason=auth_expired";
        }

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
export const getResumeById = (id) => api.get(`/resume/${id}`)

export const deleteResume = (id) => api.delete(`/resume/${id}`)

export const reparseResume = (id) => api.post(`/resume/${id}/reparse`)

export const matchATS = (p) => {
  if (typeof FormData !== 'undefined' && p instanceof FormData) {
    return api.post('/ats/match', p, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }
  return api.post('/ats/match', p)
}

export const getATSHistory = (p, config) => api.get('/ats/history', { params: p, ...config })

export const getATSResult = (id) => api.get(`/ats/result/${id}`)

export const enhanceResume = (p) => api.post('enhance/enhance-and-download', p)

export const generateQuickPractice = (p) => api.post('/interview/quick-practice', p)

export const analyzeGitHub = (p) => api.post('/github/analyze', p)

export const generatePDF = (p) => api.post('/pdf/generate', p)

export const getMyAnalytics = (p, config) =>
  api.get('/analytics/me', { params: p, ...config })



// ── Job Marketplace APIs ───────────────────────────────────────────────────
export const getJobs = (params) => api.get('/jobs', { params })
export const getJobDetail = (jobId) => api.get(`/jobs/${jobId}`)
export const createJob = (payload) => api.post('/jobs', payload)
export const updateJob = (jobId, payload) => api.put(`/jobs/${jobId}`, payload)
export const applyToJob = (jobId, payload, params) => api.post(`/jobs/${jobId}/apply`, payload || null, { params })
export const matchJobATS = (jobId, params) => api.post(`/jobs/${jobId}/match`, null, { params })
export const getMyApplications = () => api.get('/jobs/applications/my')
export const getRecommendedJobs = (params) => api.get('/jobs/recommended', { params })
export const getMyPostedJobs = () => api.get('/jobs/me')
export const getRecruiterStats = () => api.get('/jobs/recruiter/stats')
export const toggleJobStatus = (jobId, status) => api.patch(`/jobs/${jobId}/status`, { status })
export const getJobsByCompany = (companyName) => api.get(`/jobs/company/${encodeURIComponent(companyName)}`)
export const saveCompanyProfile = (payload) => api.post('/jobs/company/profile', payload)
export const getCompanyProfile = () => api.get('/company')
export const updateCompanyProfile = (payload) => api.patch('/company', payload)
export const getJobApplications = (jobId, params) => api.get(`/jobs/${jobId}/applications`, { params })
export const updateApplicationStage = (appId, stage) => api.patch(`/jobs/applications/${appId}/stage`, { stage })


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

  const tenantId = localStorage.getItem("tenant_id") || "default";

  const headers = {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
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
    let friendlyMessage = 'Failed to connect to AI Copilot.';
    try {
      const errJson = JSON.parse(errText);
      if (errJson.detail) {
        if (response.status === 401 || String(errJson.detail).toLowerCase().includes('authenticated') || String(errJson.detail).toLowerCase().includes('credential')) {
          friendlyMessage = 'Please sign in to chat with AI Copilot.';
        } else {
          friendlyMessage = errJson.detail;
        }
      }
    } catch {
      if (errText) friendlyMessage = errText;
    }
    throw new Error(friendlyMessage);
  }

  return response;
};


// Payment APIs
export const createCheckout = (plan) => api.post('/payment/checkout', { plan })
export const verifyPayment = (payload) => api.post('/payment/verify', payload)
export const choosePlan = (plan) => api.post('/payment/choose', { plan })
export const cancelSubscription = (payload) => api.post('/payment/cancel', payload || {})
export const reportPaymentFailure = (payload) => api.post('/payment/report-failure', payload)

// Auth Security APIs
export const changePassword = (current_password, new_password) =>
  api.post('/auth/change-password', { current_password, new_password })

// ── Enterprise Phase 5 APIs ──────────────────────────────────────────────────
// Requisition Management (Hiring Manager / Exec / Admin)
export const getRequisitions = (params) => api.get('/requisitions', { params })
export const createRequisition = (payload) => api.post('/requisitions', payload)
export const submitRequisition = (id) => api.post(`/requisitions/${id}/submit`)
export const recordApprovalDecision = (id, payload) => api.post(`/requisitions/${id}/decision`, payload)
export const linkRequisitionJob = (id, jobId) => api.post(`/requisitions/${id}/link-job`, { job_id: jobId })
export const getPipelineCandidates = (params) => api.get('/requisitions/pipeline/candidates', { params })

// Interview Kits & Structured Scorecards (Interviewer / Coordinator / Admin)
export const getInterviewKits = (jobId) => api.get(`/interview-kits`, { params: { job_id: jobId } })
export const submitScorecard = (payload) => api.post('/interview-kits/scorecards', payload)
export const getAssignedInterviews = () => api.get('/interview-kits/assigned')
export const getScorecardsByApplication = (applicationId) => api.get(`/interview-kits/scorecards/${applicationId}`)
export const getCalibrationReport = (applicationId, stageName) =>
  api.get(`/interview-kits/calibration`, { params: { application_id: applicationId, stage_name: stageName } })

// Consented Talent Pool (Candidate / Recruiter)
export const getTalentPoolProfile = () => api.get('/talent-pool/profile')
export const updateTalentPoolProfile = (payload) => api.post('/talent-pool/profile', payload)
export const grantTalentPoolConsent = (tier) => api.post('/talent-pool/consent', { visibility_tier: tier })
export const revokeTalentPoolConsent = () => api.post('/talent-pool/revoke')
export const getTalentPoolViewHistory = () => api.get('/talent-pool/views')
export const searchTalentPool = (params) => api.get('/talent-pool/search', { params })

// Exec Analytics (Exec / Admin read-only)
export const getExecAnalytics = () => api.get('/analytics/enterprise')

// ── Team Management & Invitations (Enterprise B2B SaaS) ──────────────────────
export const getTeamMembers = () => api.get('/team/members')
export const inviteTeamMember = (payload) => api.post('/team/invite', payload)
export const verifyInviteToken = (token) => api.get('/team/verify-invite', { params: { token } })
export const acceptTeamInvite = (payload) => api.post('/team/accept-invite', payload)
export const revokeTeamInvite = (inviteId) => api.delete(`/team/invite/${inviteId}`)
export const removeTeamMember = (userId) => api.delete(`/team/members/${userId}`)

// ── Equal Employment Opportunity (EEO) Isolated Vault ────────────────────────
export const submitEEOSelfId = (payload) => api.post('/eeo/self-identify', payload)
export const getEEOAggregateReport = () => api.get('/eeo/aggregate-report')
export const seedDemoEEOData = () => api.post('/eeo/demo-seed')

export default api