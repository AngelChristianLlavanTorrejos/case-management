import { notifyComplaintSms } from '@/lib/complaint-sms'
import { supabase } from '@/lib/supabase'

export type CreateComplaintPayload = {
  complaint_type_id: number
  complainants: string[]
  respondents: string[]
  manner: string
  relief: string
}

export type ComplaintListRow = {
  id: number
  created_at: string
  complaint_type: string
  complainants: string
  respondents: string
  is_received_and_filed: boolean
  received_and_filed_at: string | null
  is_notice_and_summon_issued: boolean
  notice_and_summon_issued_at: string | null
}

export type ComplaintListQuery = {
  search: string
  sortKey: string
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number
}

export type ComplaintListResult = {
  rows: ComplaintListRow[]
  total: number
}

export type ComplaintRecord = {
  id: number
  complaint_type_id: number
  complaint_type: string
  manner: string
  relief: string
  created_at: string
  is_received_and_filed: boolean
  received_and_filed_at: string | null
  barangay_case_no: string | null
  is_notice_and_summon_issued: boolean
  complainants: string[]
  respondents: string[]
}

function rpcError(message: string) {
  return new Error(message.replace(/^.*ERROR:\s*/i, ''))
}

function parseJson<T>(data: unknown): T {
  return (typeof data === 'string' ? JSON.parse(data) : data) as T
}

export function formatComplaintWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const NOTICE_DUE_MS = 3 * 24 * 60 * 60 * 1000

export function formatNoticeDueCountdown(
  receivedAt: string | null,
  now = Date.now(),
  issuedAt: string | null = null,
  isIssued = false,
) {
  if (!receivedAt) return '—'
  const start = new Date(receivedAt).getTime()
  if (Number.isNaN(start)) return '—'

  const deadline = start + NOTICE_DUE_MS
  if (issuedAt || isIssued) {
    const issued = issuedAt ? new Date(issuedAt).getTime() : now
    if (!Number.isNaN(issued)) return issued <= deadline ? 'On time' : 'Overdue'
  }

  const remaining = deadline - now
  if (remaining <= 0) return 'Overdue'

  const totalMinutes = Math.floor(remaining / 60_000)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  return `${days}d ${hours}h ${minutes}m`
}

export async function listComplaints(query: ComplaintListQuery): Promise<ComplaintListResult> {
  const { data, error } = await supabase.rpc('list_complaints', {
    p_search: query.search,
    p_sort_key: query.sortKey,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })

  if (error) throw rpcError(error.message)

  const parsed = parseJson<ComplaintListResult>(data)
  return {
    rows: (parsed?.rows ?? []).map((row) => ({
      ...row,
      is_received_and_filed: Boolean(row.is_received_and_filed),
      received_and_filed_at: row.received_and_filed_at ?? null,
      is_notice_and_summon_issued: Boolean(row.is_notice_and_summon_issued),
      notice_and_summon_issued_at: row.notice_and_summon_issued_at ?? null,
    })),
    total: parsed?.total ?? 0,
  }
}

export async function getComplaint(id: number): Promise<ComplaintRecord> {
  const { data, error } = await supabase.rpc('get_complaint', { p_id: id })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<ComplaintRecord>(data)
  if (!parsed?.id) throw new Error('Complaint not found')

  return {
    ...parsed,
    is_received_and_filed: Boolean(parsed.is_received_and_filed),
    received_and_filed_at: parsed.received_and_filed_at ?? null,
    barangay_case_no: parsed.barangay_case_no ?? null,
    is_notice_and_summon_issued: Boolean(parsed.is_notice_and_summon_issued),
    complainants: parsed.complainants ?? [],
    respondents: parsed.respondents ?? [],
  }
}

export async function createComplaint(
  actorUserId: number,
  payload: CreateComplaintPayload,
): Promise<{ id: number }> {
  const { data, error } = await supabase.rpc('create_complaint', {
    p_actor_user_id: actorUserId,
    p_complaint_type_id: payload.complaint_type_id,
    p_complainants: payload.complainants,
    p_respondents: payload.respondents,
    p_manner: payload.manner,
    p_relief: payload.relief,
  })

  if (error) throw rpcError(error.message)

  const parsed = (typeof data === 'string' ? JSON.parse(data) : data) as { id?: number }
  if (!parsed?.id) throw new Error('Complaint was not saved.')
  return { id: parsed.id }
}

export async function updateComplaint(
  id: number,
  actorUserId: number,
  payload: CreateComplaintPayload,
): Promise<void> {
  const { error } = await supabase.rpc('update_complaint', {
    p_id: id,
    p_actor_user_id: actorUserId,
    p_complaint_type_id: payload.complaint_type_id,
    p_complainants: payload.complainants,
    p_respondents: payload.respondents,
    p_manner: payload.manner,
    p_relief: payload.relief,
  })

  if (error) throw rpcError(error.message)
}

export async function markComplaintReceivedAndFiled(id: number, actorUserId: number): Promise<void> {
  const { error } = await supabase.rpc('mark_complaint_received_and_filed', {
    p_id: id,
    p_actor_user_id: actorUserId,
  })
  if (error) throw rpcError(error.message)
  await notifyComplaintSms('received_and_filed', id)
}

export async function deleteComplaint(id: number, actorUserId: number): Promise<void> {
  const { error } = await supabase.rpc('delete_complaint', {
    p_id: id,
    p_actor_user_id: actorUserId,
  })
  if (error) throw rpcError(error.message)
}
