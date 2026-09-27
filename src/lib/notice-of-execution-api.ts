import { supabase } from '@/lib/supabase'

export type ExecutionCaseOption = {
  id: number
  barangay_case_no: string | null
  complainants: string
  respondents: string
  terms: string
}

export type ExecutionListRow = {
  id: number
  notice_motion_id: number
  complaint_id: number
  barangay_case_no: string | null
  complainants: string
  respondents: string
  party_obliged: 'complainants' | 'respondents'
  amount: string
  created_at: string
}

export type ExecutionRecord = {
  id: number
  notice_motion_id: number
  complaint_id: number
  barangay_case_no: string | null
  complaint_type: string
  complainants: string[]
  respondents: string[]
  settlement_created_at: string
  terms: string
  party_obliged: 'complainants' | 'respondents'
  personal_property_of: string
  amount: string
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

export function formatPartyObliged(value: string) {
  if (value === 'complainants') return 'Complainants'
  if (value === 'respondents') return 'Respondents'
  return value || '—'
}

export async function listNoticeOfExecutionCases(): Promise<ExecutionCaseOption[]> {
  const { data, error } = await supabase.rpc('list_notice_of_execution_cases')
  if (error) throw rpcError(error.message)

  const parsed = parseJson<ExecutionCaseOption[]>(data)
  return parsed ?? []
}

export async function createNoticeOfExecution(
  noticeMotionId: number,
  actorUserId: number,
  partyObliged: 'complainants' | 'respondents',
  personalPropertyOf: string,
  amount: string,
): Promise<{ id: number }> {
  const { data, error } = await supabase.rpc('create_notice_of_execution', {
    p_notice_motion_id: noticeMotionId,
    p_actor_user_id: actorUserId,
    p_party_obliged: partyObliged,
    p_personal_property_of: personalPropertyOf,
    p_amount: amount,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ id?: number }>(data)
  if (!parsed?.id) throw new Error('Notice of execution was not saved.')
  return { id: parsed.id }
}

export async function listNoticesOfExecution(query: ListQuery) {
  const { data, error } = await supabase.rpc('list_notices_of_execution', {
    p_search: query.search,
    p_sort_key: query.sortKey,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ rows: ExecutionListRow[]; total: number }>(data)
  return { rows: parsed?.rows ?? [], total: parsed?.total ?? 0 }
}

export async function getNoticeOfExecution(id: number): Promise<ExecutionRecord> {
  const { data, error } = await supabase.rpc('get_notice_of_execution', { p_id: id })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<ExecutionRecord>(data)
  if (!parsed?.id) throw new Error('Notice of execution not found')
  return {
    ...parsed,
    barangay_case_no: parsed.barangay_case_no ?? null,
    complaint_type: parsed.complaint_type ?? '',
    complainants: parsed.complainants ?? [],
    respondents: parsed.respondents ?? [],
    terms: parsed.terms ?? '',
    personal_property_of: parsed.personal_property_of ?? '',
    amount: parsed.amount ?? '',
  }
}

export async function markNoticeOfHearingMotionSettled(id: number, actorUserId: number) {
  const { error } = await supabase.rpc('mark_notice_of_hearing_motion_settled', {
    p_id: id,
    p_actor_user_id: actorUserId,
  })
  if (error) throw rpcError(error.message)
}
