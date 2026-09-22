import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Sparkles,
  Trophy,
  Flame,
  AlertCircle,
  X,
  CheckCheck,
  Trash2
} from 'lucide-react'
import {
  fetchMyNotifications,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
  dismissNotification
} from '../services/notificationApi'

const STORAGE_CLEARED_KEY = 'careershala_notifs_cleared_at'
const STORAGE_DISMISSED_KEY = 'careershala_notifs_dismissed_ids'

// Clean, subtle iconography without loud rainbow gradients
const notificationIconMap = {
  xp: {
    icon: Sparkles,
    iconColor: 'text-indigo-600 bg-indigo-50 border-indigo-100'
  },
  badge: {
    icon: Trophy,
    iconColor: 'text-amber-600 bg-amber-50 border-amber-100'
  },
  streak: {
    icon: Flame,
    iconColor: 'text-orange-600 bg-orange-50 border-orange-100'
  },
  alert: {
    icon: AlertCircle,
    iconColor: 'text-rose-600 bg-rose-50 border-rose-100'
  }
}

function getLocalDismissedIds() {
  try {
    const raw = localStorage.getItem(STORAGE_DISMISSED_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function addLocalDismissedId(id) {
  try {
    const current = getLocalDismissedIds()
    if (!current.includes(id)) {
      localStorage.setItem(STORAGE_DISMISSED_KEY, JSON.stringify([...current, id]))
    }
  } catch {
    // Ignore storage quota
  }
}

function getLocalClearedAt() {
  try {
    const raw = localStorage.getItem(STORAGE_CLEARED_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

function formatNotificationTime(createdAt) {
  if (!createdAt) return 'Just now'
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) return 'Just now'

  return formatDistanceToNow(parsed, { addSuffix: true })
}

function normalizeNotification(notification) {
  const createdAt = notification?.created_at || notification?.createdAt || null
  const timestamp = createdAt ? new Date(createdAt).getTime() : Date.now()

  return {
    id: String(notification?.id || `notif_${Date.now()}_${Math.random()}`),
    type: notification?.type || 'xp',
    title: notification?.title || 'New Notification',
    message: notification?.message || '',
    created_at: createdAt,
    timestamp: isNaN(timestamp) ? Date.now() : timestamp,
    is_read: Boolean(notification?.is_read),
    link: notification?.link || null
  }
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.is_read).length,
    [notifications]
  )

  const loadNotifications = async () => {
    try {
      const response = await fetchMyNotifications()
      const payload = response?.data ?? response
      const rawItems = Array.isArray(payload) ? payload : (payload?.notifications || [])

      const clearedAt = getLocalClearedAt()
      const dismissedIds = new Set(getLocalDismissedIds())

      const validItems = rawItems
        .map(normalizeNotification)
        .filter(item => {
          if (dismissedIds.has(item.id)) return false
          if (clearedAt && item.timestamp <= clearedAt) return false
          return true
        })

      setNotifications(validItems)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      setNotifications([])
    }
  }

  useEffect(() => {
    loadNotifications()

    const onTriggerNotification = (event) => {
      const incoming = event?.detail?.notification ?? event?.detail ?? event
      const normalized = normalizeNotification({
        ...incoming,
        id: incoming?.id ?? `live_${Date.now()}`,
        is_read: incoming?.is_read ?? false,
        created_at: incoming?.created_at ?? new Date().toISOString()
      })

      setNotifications(current => [normalized, ...current.filter(n => n.id !== normalized.id)])
    }

    window.addEventListener('trigger-notification', onTriggerNotification)
    return () => {
      window.removeEventListener('trigger-notification', onTriggerNotification)
    }
  }, [])

  // Close on outside click or Escape
  useEffect(() => {
    const onMouseDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      setNotifications(current =>
        current.map(n => (n.id === notification.id ? { ...n, is_read: true } : n))
      )
      try {
        await markAsRead(notification.id)
      } catch (err) {
        console.error('Failed to mark read:', err)
      }
    }

    if (notification.link) {
      setIsOpen(false)
      navigate(notification.link)
    }
  }

  const handleDismissSingle = async (e, id) => {
    e.stopPropagation()
    setNotifications(current => current.filter(n => n.id !== id))
    addLocalDismissedId(id)

    try {
      await dismissNotification(id)
    } catch (err) {
      console.error('Failed to dismiss notification:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return
    setNotifications(current => current.map(n => ({ ...n, is_read: true })))

    try {
      await markAllAsRead()
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  const handleClearAll = async () => {
    if (notifications.length === 0) return
    const now = Date.now()
    localStorage.setItem(STORAGE_CLEARED_KEY, now.toString())
    setNotifications([])

    try {
      await clearAllNotifications()
    } catch (err) {
      console.error('Failed to clear all notifications:', err)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(curr => !curr)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
        )}
      </button>

      {/* Standard Clean Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-slate-500 hover:text-blue-600 transition-colors font-medium"
                  >
                    Mark all read
                  </button>
                )}

                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
              {notifications.length > 0 ? (
                notifications.map((item) => {
                  const cfg = notificationIconMap[item.type] || notificationIconMap.xp
                  const IconComponent = cfg.icon

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={`group relative flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${
                        !item.is_read ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Subtle Clean Icon */}
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${cfg.iconColor}`}
                      >
                        <IconComponent size={15} />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="flex items-center justify-between gap-1">
                          <p
                            className={`text-xs leading-snug truncate ${
                              !item.is_read
                                ? 'font-semibold text-slate-900'
                                : 'font-medium text-slate-700'
                            }`}
                          >
                            {item.title}
                          </p>
                          <span className="text-[11px] text-slate-400 shrink-0">
                            {formatNotificationTime(item.created_at)}
                          </span>
                        </div>

                        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed line-clamp-2">
                          {item.message}
                        </p>
                      </div>

                      {/* Hover Dismiss / Unread indicator */}
                      <div className="shrink-0 flex items-center self-center">
                        <button
                          type="button"
                          onClick={(e) => handleDismissSingle(e, item.id)}
                          title="Dismiss"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                        >
                          <X size={13} />
                        </button>
                        {!item.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 group-hover:hidden ml-1" />
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                /* Clean Minimal Empty State */
                <div className="py-12 px-4 text-center">
                  <Bell size={24} className="mx-auto text-slate-300 stroke-[1.5]" />
                  <p className="mt-2 text-xs font-medium text-slate-600">No notifications</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">You're all caught up!</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}