import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import {
  Bell,
  BadgeCheck,
  Sparkles,
  ShieldAlert,
  Trophy,
  Star,
  X,
  CheckCheck
} from 'lucide-react'
import {
  fetchMyNotifications,
  markAsRead,
  markAllAsRead
} from '../services/notificationApi'

const notificationIconMap = {
  xp: {
    icon: Sparkles,
    iconClassName: 'text-sky-600',
    badgeClassName: 'bg-sky-100 text-sky-700 border-sky-200',
    itemAccentClassName: 'border-l-sky-500',
    backgroundClassName: 'bg-sky-50/80'
  },
  badge: {
    icon: Trophy,
    iconClassName: 'text-amber-600',
    badgeClassName: 'bg-amber-100 text-amber-700 border-amber-200',
    itemAccentClassName: 'border-l-amber-500',
    backgroundClassName: 'bg-amber-50/80'
  },
  alert: {
    icon: ShieldAlert,
    iconClassName: 'text-rose-600',
    badgeClassName: 'bg-rose-100 text-rose-700 border-rose-200',
    itemAccentClassName: 'border-l-rose-500',
    backgroundClassName: 'bg-rose-50/80'
  },
  streak: {
    icon: Star,
    iconClassName: 'text-emerald-600',
    badgeClassName: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    itemAccentClassName: 'border-l-emerald-500',
    backgroundClassName: 'bg-emerald-50/80'
  }
}

const dropdownVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.18,
      ease: 'easeOut',
      staggerChildren: 0.06,
      delayChildren: 0.04
    }
  },
  exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.14, ease: 'easeIn' } }
}

const itemVariants = {
  hidden: { opacity: 0, x: 10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.18, ease: 'easeOut' } }
}

function normalizeNotification(notification) {
  const createdAt = notification?.created_at || notification?.createdAt || null

  return {
    id: notification?.id,
    type: notification?.type || 'xp',
    title: notification?.title || 'Notification',
    message: notification?.message || '',
    created_at: createdAt,
    is_read: Boolean(notification?.is_read),
    time: createdAt ? formatNotificationTime(createdAt) : 'Just now'
  }
}

function formatNotificationTime(createdAt) {
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) return 'Just now'

  return formatDistanceToNow(parsed, { addSuffix: true })
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isRinging, setIsRinging] = useState(false)
  const menuRef = useRef(null)

  const unreadCount = useMemo(
    () => notifications.filter(notification => !notification.is_read).length,
    [notifications]
  )

  const toggleOpen = () => {
    setIsOpen(current => !current)
  }

  const handleNotificationClick = async (id) => {
    try {
      await markAsRead(id)
      setNotifications(currentNotifications =>
        currentNotifications.map(notification =>
          notification.id === id ? { ...notification, is_read: true } : notification
        )
      )
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

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

  useEffect(() => {
    let isMounted = true

    const loadNotifications = async () => {
      try {
        const response = await fetchMyNotifications()
        const payload = response?.data ?? response
        const items = Array.isArray(payload) ? payload : (payload?.notifications || [])

        if (!isMounted) return

        setNotifications(items.map(normalizeNotification))
      } catch (error) {
        console.error('Failed to fetch notifications:', error)
        if (isMounted) setNotifications([])
      }
    }

    const onTriggerNotification = (event) => {
      const incoming = event?.detail?.notification ?? event?.detail ?? event
      const normalized = normalizeNotification({
        ...incoming,
        id: incoming?.id ?? Date.now(),
        is_read: incoming?.is_read ?? false,
        created_at: incoming?.created_at ?? new Date().toISOString()
      })

      setNotifications(currentNotifications => [normalized, ...currentNotifications])
      setIsRinging(true)
      window.setTimeout(() => setIsRinging(false), 900)
    }

    loadNotifications()
    window.addEventListener('trigger-notification', onTriggerNotification)

    return () => {
      isMounted = false
      window.removeEventListener('trigger-notification', onTriggerNotification)
    }
  }, [])

  const bellMotion = isRinging
    ? {
        rotate: [0, -12, 12, -8, 8, 0],
        transition: { duration: 0.9, ease: 'easeInOut' }
      }
    : { rotate: 0 }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="relative flex items-center justify-center p-2.5 rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200/80 text-slate-600 shadow-sm transition-all hover:bg-white hover:border-slate-300 hover:shadow-md active:scale-95"
      >
        <motion.div animate={bellMotion} className="relative">
          <Bell size={20} strokeWidth={2.5} />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute -top-1.5 -right-1.5 flex min-w-5 h-5 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 px-1 text-[10px] font-extrabold text-white shadow-[0_0_0_4px_rgba(255,255,255,0.9)]"
              >
                <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-30" />
                <span className="relative z-10 leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial="hidden"
            animate="show"
            exit="exit"
            variants={dropdownVariants}
            className="absolute right-0 mt-3 w-[min(92vw,24rem)] overflow-hidden rounded-2xl border border-white/60 bg-white/90 backdrop-blur-md shadow-[0_8px_30px_rgba(30,58,138,0.1)] ring-1 ring-slate-200/60 z-50"
          >
            <div className="relative border-b border-slate-200/70 bg-gradient-to-r from-sky-50 via-white to-indigo-50 px-4 py-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.14),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_38%)]" />
              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Activity feed</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">Notifications</h3>
                </div>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await markAllAsRead()
                          setNotifications(currentNotifications =>
                            currentNotifications.map(notification => ({
                              ...notification,
                              is_read: true
                            }))
                          )
                        } catch (error) {
                          console.error('Failed to mark all notifications as read:', error)
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50 hover:border-sky-300"
                    >
                      <CheckCheck size={14} />
                      Mark all as read
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white/90 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    aria-label="Close notifications"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>

            <motion.div className="max-h-[24rem] overflow-y-auto p-3" variants={dropdownVariants}>
              {notifications.length > 0 ? (
                notifications.map(notification => {
                  const typeConfig = notificationIconMap[notification.type] || notificationIconMap.xp
                  const Icon = typeConfig.icon

                  return (
                    <motion.button
                      key={notification.id}
                      type="button"
                      variants={itemVariants}
                      onClick={() => handleNotificationClick(notification.id)}
                      className={`group mb-2 flex w-full items-start gap-3 rounded-2xl border border-slate-200/80 px-3 py-3 text-left transition-all hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-md ${typeConfig.backgroundClassName} ${!notification.is_read ? `border-l-4 ${typeConfig.itemAccentClassName}` : ''}`}
                    >
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${typeConfig.badgeClassName} shadow-sm`}>
                        <Icon size={18} strokeWidth={2.35} className={typeConfig.iconClassName} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                            <p className="mt-1 text-sm leading-5 text-slate-600">{notification.message}</p>
                          </div>

                          {!notification.is_read && (
                            <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500 ring-4 ring-sky-100" />
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
                            <BadgeCheck size={12} />
                            {notification.type}
                          </span>
                          <span className="text-xs font-medium text-slate-400">
                            {notification.time || (notification.created_at ? formatNotificationTime(notification.created_at) : 'Just now')}
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 shadow-inner">
                    <Bell size={22} strokeWidth={2.2} />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-900">You’re all caught up</p>
                  <p className="mt-1 text-sm text-slate-500">New rewards, alerts, and updates will appear here.</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}