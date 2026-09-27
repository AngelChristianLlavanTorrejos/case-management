import { supabase } from '@/lib/supabase'

export type AmicableSettlementCaseOption = {
  id: number
  barangay_case_no: string | null
  complainants: string
  respondents: string
}

export type AmicableSettlementListRow = {
  id: number
  complaint_id: number
  barangay_case_no: string | null
  complainants: string
  respondents: string
  created_at: string
  is_settled: boolean
  status: string | null
}

export type AmicableSettlementRecord = {
  id: number
  complaint_id: number
  barangay_case_no: string | null
  complaint_type: string
  complainants: string[]
  respondents: string[]
  terms: string
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

export async function listAmicableSettlementCases(): Promise<AmicableSettlementCaseOption[]> {
  const { data, error } = await supabase.rpc('list_amicable_settlement_cases')
  if (error) throw rpcError(error.message)

  const parsed = parseJson<AmicableSettlementCaseOption[]>(data)
  return parsed ?? []
}

export async function createAmicableSettlement(
  complaintId: number,
  actorUserId: number,
  terms: string,
): Promise<{ id: number }> {
  const { data, error } = await supabase.rpc('create_amicable_settlement', {
    p_complaint_id: complaintId,
    p_actor_user_id: actorUserId,
    p_terms: terms,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ id?: number }>(data)
  if (!parsed?.id) throw new Error('Amicable settlement was not saved.')
  return { id: parsed.id }
}

export async function listAmicableSettlements(query: ListQuery) {
  const { data, error } = await supabase.rpc('list_amicable_settlements', {
    p_search: query.search,
    p_sort_key: query.sortKey,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ rows: AmicableSettlementListRow[]; total: number }>(data)
  return {
    rows: (parsed?.rows ?? []).map((row) => ({
      ...row,
      is_settled: row.status === 'settled' || Boolean(row.is_settled),
      status: row.status ?? null,
    })),
    total: parsed?.total ?? 0,
  }
}

export async function markAmicableSettlementSettled(id: number, actorUserId: number) {
  const { error } = await supabase.rpc('mark_amicable_settlement_settled', {
    p_id: id,
    p_actor_user_id: actorUserId,
  })
  if (error) throw rpcError(error.message)
}

export async function getAmicableSettlement(id: number): Promise<AmicableSettlementRecord> {
  const { data, error } = await supabase.rpc('get_amicable_settlement', { p_id: id })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<AmicableSettlementRecord>(data)
  if (!parsed?.id) throw new Error('Amicable settlement not found')
  return {
    ...parsed,
    barangay_case_no: parsed.barangay_case_no ?? null,
    complaint_type: parsed.complaint_type ?? '',
    complainants: parsed.complainants ?? [],
    respondents: parsed.respondents ?? [],
    terms: parsed.terms ?? '',
  }
}
