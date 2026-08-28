import api from './api';

/**
 * Upload and parse resume PDF into structured portfolio data
 * @param {File} file 
 */
export async function parseResumeForPortfolio(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/portfolio/parse-resume', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Upload candidate profile photo
 * @param {File} file 
 */
export async function uploadPortfolioPhoto(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/portfolio/upload-photo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * AI Content Enhancer for project descriptions or bios
 * @param {string} rawText 
 * @param {string} targetRole 
 */
export async function enhancePortfolioContent(rawText, targetRole = 'Software Engineer') {
  const response = await api.post('/portfolio/enhance-content', {
    raw_text: rawText,
    target_role: targetRole,
  });
  return response.data;
}

/**
 * Save or publish portfolio document
 * @param {Object} profileData 
 */
export async function savePortfolio(profileData) {
  const response = await api.post('/portfolio/save', profileData);
  return response.data;
}

/**
 * Fetch current authenticated user's portfolio
 * @param {boolean} syncFromResume
 */
export async function getMyPortfolio(syncFromResume = false) {
  const response = await api.get(`/portfolio/me${syncFromResume ? '?sync_from_resume=true' : ''}`);
  return response.data;
}

/**
 * Fetch public portfolio data by username
 * @param {string} username 
 */
export async function getPublicPortfolio(username) {
  const response = await api.get(`/portfolio/public/${username}`);
  return response.data;
}

/**
 * Track an analytics event (view, download, contact_click)
 * @param {string} username 
 * @param {'view'|'download'|'contact_click'} eventType 
 */
export async function trackPortfolioEvent(username, eventType) {
  try {
    const response = await api.post(`/portfolio/analytics/track/${username}/${eventType}`);
    return response.data;
  } catch (e) {
    // Silent fail for analytics
    return null;
  }
}

/**
 * Send dynamic contact message to candidate
 * @param {string} username 
 * @param {Object} messageData 
 */
export async function sendContactMessage(username, messageData) {
  const response = await api.post(`/portfolio/contact/${username}`, messageData);
  return response.data;
}

/**
 * Check slug/username availability in real-time
 * @param {string} slug 
 */
export async function checkSlugAvailability(slug) {
  const response = await api.get(`/portfolio/check-slug?slug=${encodeURIComponent(slug)}`);
  return response.data;
}

