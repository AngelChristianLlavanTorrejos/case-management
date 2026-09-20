import { supabase } from '@/lib/supabase'

export type ActivityLogActivity =
  | 'add'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'restrict'
  | 'login_failed'

export type ActivityLogListRow = {
  id: number
  user_name: string
  activity: ActivityLogActivity
  menu_name: string
  created_at: string
}

export type ActivityLogDetail = {
  id: number
  user_name: string
  activity: ActivityLogActivity
  menu_name: string
  details: string
  created_at: string
}

export type ActivityLogListQuery = {
  search: string
  sortKey: string
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number
}

export type ActivityLogListResult = {
  rows: ActivityLogListRow[]
  total: number
}

function rpcError(message: string) {
  return new Error(message.replace(/^.*ERROR:\s*/i, ''))
}

function parseJson<T>(data: unknown): T {
  return (typeof data === 'string' ? JSON.parse(data) : data) as T
}

export const ACTIVITY_LABELS: Record<ActivityLogActivity, string> = {
  add: 'Add',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  restrict: 'Restrict',
  login_failed: 'Login failed',
}

export function activityLabel(activity: string) {
  return ACTIVITY_LABELS[activity as ActivityLogActivity] ?? activity
}

export function formatActivityWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export async function listActivityLogs(query: ActivityLogListQuery): Promise<ActivityLogListResult> {
  const { data, error } = await supabase.rpc('list_user_activity_logs', {
    p_search: query.search,
    p_sort_key: query.sortKey,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })

  if (error) throw rpcError(error.message)

  const parsed = parseJson<ActivityLogListResult>(data)

  return {
    rows: parsed?.rows ?? [],
    total: parsed?.total ?? 0,
  }
}

export async function getActivityLog(id: number): Promise<ActivityLogDetail> {
  const { data, error } = await supabase.rpc('get_user_activity_log', { p_id: id })
  if (error) throw rpcError(error.message)
  return parseJson<ActivityLogDetail>(data)
}
