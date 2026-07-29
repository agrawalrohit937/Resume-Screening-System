import api from './api'

export const fetchMyNotifications = async () => {
  try {
    const { data } = await api.get('/notifications/me')
    return data
  } catch (err) {
    return { notifications: [], unread_count: 0 }
  }
}

export const markAsRead = async (id) => {
  try {
    const { data } = await api.post(`/notifications/${id}/read`)
    return data
  } catch (err) {
    return { status: 'success', id }
  }
}

export const markAllAsRead = async () => {
  try {
    const { data } = await api.post('/notifications/read-all')
    return data
  } catch (err) {
    return { status: 'success' }
  }
}