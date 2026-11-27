/**
 * Revenue Recovery API Service
 * Interacts with AI Revenue Recovery agent backend endpoints
 */
import api from './api'

export const getMyRecoveryBanner = async () => {
  const { data } = await api.get('/revenue-recovery/my-recovery-banner')
  return data
}
