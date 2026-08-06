import api from './api';

/**
 * Submit job application to backend with optional PDF resume file upload.
 * @param {FormData|Object} payload - FormData instance or Object
 */
export async function submitCareerApplication(payload) {
  let body = payload;
  
  if (!(payload instanceof FormData)) {
    body = new FormData();
    Object.keys(payload).forEach((key) => {
      if (payload[key] !== undefined && payload[key] !== null) {
        body.append(key, payload[key]);
      }
    });
  }

  const response = await api.post('/careers/apply', body, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}
