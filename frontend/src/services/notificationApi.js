import api from './api'

export const fetchMyNotifications = async () => {
  const { data } = await api.get('/notifications/me')
  return data
}

export const markAsRead = async (id) => {
  const { data } = await api.post(`/notifications/${id}/read`)
  return data
}

export const markAllAsRead = async () => {
  const { data } = await api.post('/notifications/read-all')
  return data
}