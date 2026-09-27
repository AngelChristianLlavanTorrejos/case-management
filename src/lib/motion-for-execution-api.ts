import { supabase } from '@/lib/supabase'

export type MotionCaseOption = {
  id: number
  barangay_case_no: string | null
  complainants: string
  respondents: string
}

export type MotionListRow = {
  id: number
  complaint_id: number
  barangay_case_no: string | null
  complainants: string
  respondents: string
  created_at: string
  has_notice: boolean
}

export type MotionRecord = {
  id: number
  complaint_id: number
  barangay_case_no: string | null
  complaint_type: string
  complainants: string[]
  respondents: string[]
  settlement_created_at: string
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

export async function listMotionForExecutionCases(): Promise<MotionCaseOption[]> {
  const { data, error } = await supabase.rpc('list_motion_for_execution_cases')
  if (error) throw rpcError(error.message)

  const parsed = parseJson<MotionCaseOption[]>(data)
  return parsed ?? []
}

export async function createMotionForExecution(
  complaintId: number,
  actorUserId: number,
): Promise<{ id: number }> {
  const { data, error } = await supabase.rpc('create_motion_for_execution', {
    p_complaint_id: complaintId,
    p_actor_user_id: actorUserId,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ id?: number }>(data)
  if (!parsed?.id) throw new Error('Motion for execution was not saved.')
  return { id: parsed.id }
}

export async function listMotionsForExecution(query: ListQuery) {
  const { data, error } = await supabase.rpc('list_motions_for_execution', {
    p_search: query.search,
    p_sort_key: query.sortKey,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ rows: MotionListRow[]; total: number }>(data)
  return {
    rows: (parsed?.rows ?? []).map((row) => ({
      ...row,
      has_notice: Boolean(row.has_notice),
    })),
    total: parsed?.total ?? 0,
  }
}

export async function getMotionForExecution(id: number): Promise<MotionRecord> {
  const { data, error } = await supabase.rpc('get_motion_for_execution', { p_id: id })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<MotionRecord>(data)
  if (!parsed?.id) throw new Error('Motion for execution not found')
  return {
    ...parsed,
    barangay_case_no: parsed.barangay_case_no ?? null,
    complaint_type: parsed.complaint_type ?? '',
    complainants: parsed.complainants ?? [],
    respondents: parsed.respondents ?? [],
    settlement_created_at: parsed.settlement_created_at,
    created_at: parsed.created_at,
  }
}
