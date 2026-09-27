import { supabase } from '@/lib/supabase'

export type NoticeMotionListRow = {
  id: number
  motion_id: number
  complaint_id: number
  barangay_case_no: string | null
  complainants: string
  respondents: string
  appear_at: string
  filed_by: 'complainants' | 'respondents'
  issued_on: string
  status: string | null
}

export type NoticeMotionRecord = {
  id: number
  motion_id: number
  complaint_id: number
  barangay_case_no: string | null
  complaint_type: string
  complainants: string[]
  respondents: string[]
  appear_at: string
  filed_by: 'complainants' | 'respondents'
  issued_on: string
  created_at: string
}

type ListQuery = {
  search: string
  sortKey: string
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number
}

function rpcError(message: string) {
  return new Error(message.replace(/^.*ERROR:\s*/i, ''))
}

function parseJson<T>(data: unknown): T {
  return (typeof data === 'string' ? JSON.parse(data) : data) as T
}

export async function issueNoticeOfHearingMotion(
  motionId: number,
  actorUserId: number,
  appearAt: string,
  filedBy: 'complainants' | 'respondents',
): Promise<{ id: number }> {
  const { data, error } = await supabase.rpc('issue_notice_of_hearing_motion', {
    p_motion_id: motionId,
    p_actor_user_id: actorUserId,
    p_appear_at: appearAt,
    p_filed_by: filedBy,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ id?: number }>(data)
  if (!parsed?.id) throw new Error('Notice of hearing was not saved.')
  return { id: parsed.id }
}

export async function listNoticesOfHearingMotion(query: ListQuery) {
  const { data, error } = await supabase.rpc('list_notices_of_hearing_motion', {
    p_search: query.search,
    p_sort_key: query.sortKey,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ rows: NoticeMotionListRow[]; total: number }>(data)
  return {
    rows: (parsed?.rows ?? []).map((row) => ({
      ...row,
      status: row.status ?? null,
    })),
    total: parsed?.total ?? 0,
  }
}

export async function getNoticeOfHearingMotion(id: number): Promise<NoticeMotionRecord> {
  const { data, error } = await supabase.rpc('get_notice_of_hearing_motion', { p_id: id })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<NoticeMotionRecord>(data)
  if (!parsed?.id) throw new Error('Notice of hearing (motion) not found')
  return {
    ...parsed,
    barangay_case_no: parsed.barangay_case_no ?? null,
    complaint_type: parsed.complaint_type ?? '',
    complainants: parsed.complainants ?? [],
    respondents: parsed.respondents ?? [],
    filed_by: parsed.filed_by,
  }
}

export function formatFiledBy(value: string) {
  if (value === 'complainants') return 'Complainants'
  if (value === 'respondents') return 'Respondents'
  return value || '—'
}
