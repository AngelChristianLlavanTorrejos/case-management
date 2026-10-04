import { supabase } from '@/lib/supabase'

export type NotificationItem = {
  id: number
  title: string
  body: string
  path: string | null
  read_at: string | null
  created_at: string
}

export type NotificationList = {
  unread_count: number
  items: NotificationItem[]
}

function rpcError(message: string) {
  return new Error(message.replace(/^.*ERROR:\s*/i, ''))
}

function parseJson<T>(data: unknown): T {
  return (typeof data === 'string' ? JSON.parse(data) : data) as T
}

export function formatNotificationWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export async function listNotifications(actorUserId: number): Promise<NotificationList> {
  const { data, error } = await supabase.rpc('list_notifications', {
    p_actor_user_id: actorUserId,
  })

  if (error) throw rpcError(error.message)

  const parsed = parseJson<NotificationList>(data)
  return {
    unread_count: parsed?.unread_count ?? 0,
    items: parsed?.items ?? [],
  }
}

export async function markNotificationRead(id: number, actorUserId: number) {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_id: id,
    p_actor_user_id: actorUserId,
  })

  if (error) throw rpcError(error.message)
}

export async function markAllNotificationsRead(actorUserId: number) {
  const { error } = await supabase.rpc('mark_all_notifications_read', {
    p_actor_user_id: actorUserId,
  })

  if (error) throw rpcError(error.message)
}
