import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAnyDialogOpen } from '@/components/ui/dialog'
import {
  formatNotificationWhen,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/lib/notifications-api'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

function badgeLabel(count: number) {
  if (count > 9) return '9+'
  return String(count)
}

export function NotificationBell() {
  const userId = useAuthStore((state) => state.session?.id)
  const dialogOpen = useAnyDialogOpen()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const notifications = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => listNotifications(userId!),
    enabled: userId != null,
  })

  useEffect(() => {
    if (userId == null) return

    const channel = supabase.channel(`notifications:${userId}`, {
      config: { private: false },
    })

    channel.on('broadcast', { event: 'notification' }, () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    })

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, userId])

  useEffect(() => {
    if (dialogOpen) setOpen(false)
  }, [dialogOpen])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const markOne = useMutation({
    mutationFn: (id: number) => markNotificationRead(id, userId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })

  const unread = notifications.data?.unread_count ?? 0
  const items = notifications.data?.items ?? []

  function openItem(item: NotificationItem) {
    setOpen(false)
    if (item.read_at == null) markOne.mutate(item.id)
    if (item.path) navigate(item.path)
  }

  return (
    <div ref={panelRef} className={cn('relative', dialogOpen && 'hidden')}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative bg-white"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell />
        {unread > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground">
            {badgeLabel(unread)}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute top-full right-0 z-80 mt-2 flex max-h-[min(24rem,70vh)] w-88 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-[#E5E5E6] bg-white shadow-md"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#E5E5E6] px-3 py-2.5">
            <p className="text-sm font-medium text-foreground">Notifications</p>
            <button
              type="button"
              className="cursor-pointer text-xs font-medium text-primary disabled:cursor-default disabled:opacity-40"
              disabled={unread === 0 || markAll.isPending || userId == null}
              onClick={() => markAll.mutate()}
            >
              Mark all read
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {notifications.isLoading ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">Loading notifications…</p>
            ) : notifications.isError ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">
                Notifications could not be loaded.
              </p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">No notifications.</p>
            ) : (
              <ul>
                {items.map((item) => {
                  const unreadItem = item.read_at == null
                  return (
                    <li key={item.id} className="border-b border-[#E5E5E6] last:border-b-0">
                      <button
                        type="button"
                        className={cn(
                          'flex w-full cursor-pointer gap-2.5 px-3 py-2.5 text-left hover:bg-muted',
                          unreadItem && 'bg-muted/60',
                        )}
                        onClick={() => openItem(item)}
                      >
                        <span
                          className={cn(
                            'mt-1.5 size-2 shrink-0 rounded-full',
                            unreadItem ? 'bg-primary' : 'bg-transparent',
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground">{item.title}</span>
                          <span className="mt-0.5 block text-sm text-muted-foreground">{item.body}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {formatNotificationWhen(item.created_at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
