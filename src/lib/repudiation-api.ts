import { supabase } from '@/lib/supabase'

export type RepudiationCaseOption = {
  id: number
  barangay_case_no: string | null
  complainants: string
  respondents: string
}

export type RepudiationListRow = {
  id: number
  complaint_id: number
  barangay_case_no: string | null
  complainants: string
  respondents: string
  created_at: string
}

export type RepudiationRecord = {
  id: number
  complaint_id: number
  barangay_case_no: string | null
  complaint_type: string
  complainants: string[]
  respondents: string[]
  fraud: boolean
  fraud_details: string
  violence: boolean
  violence_details: string
  intimidation: boolean
  intimidation_details: string
  sworn_on: string
  received_and_filed_on: string
  created_at: string
}

export type CreateRepudiationPayload = {
  complaintId: number
  fraud: boolean
  fraudDetails: string
  violence: boolean
  violenceDetails: string
  intimidation: boolean
  intimidationDetails: string
  swornOn: string
  receivedAndFiledOn: string
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

export async function listRepudiationCases(): Promise<RepudiationCaseOption[]> {
  const { data, error } = await supabase.rpc('list_repudiation_cases')
  if (error) throw rpcError(error.message)

  const parsed = parseJson<RepudiationCaseOption[]>(data)
  return parsed ?? []
}

export async function createRepudiation(
  actorUserId: number,
  payload: CreateRepudiationPayload,
): Promise<{ id: number }> {
  const { data, error } = await supabase.rpc('create_repudiation', {
    p_complaint_id: payload.complaintId,
    p_actor_user_id: actorUserId,
    p_fraud: payload.fraud,
    p_fraud_details: payload.fraudDetails,
    p_violence: payload.violence,
    p_violence_details: payload.violenceDetails,
    p_intimidation: payload.intimidation,
    p_intimidation_details: payload.intimidationDetails,
    p_sworn_on: payload.swornOn,
    p_received_and_filed_on: payload.receivedAndFiledOn,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ id?: number }>(data)
  if (!parsed?.id) throw new Error('Repudiation was not saved.')
  return { id: parsed.id }
}

export async function listRepudiations(query: ListQuery) {
  const { data, error } = await supabase.rpc('list_repudiations', {
    p_search: query.search,
    p_sort_key: query.sortKey,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ rows: RepudiationListRow[]; total: number }>(data)
  return { rows: parsed?.rows ?? [], total: parsed?.total ?? 0 }
}

export async function getRepudiation(id: number): Promise<RepudiationRecord> {
  const { data, error } = await supabase.rpc('get_repudiation', { p_id: id })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<RepudiationRecord>(data)
  if (!parsed?.id) throw new Error('Repudiation not found')
  return {
    ...parsed,
    barangay_case_no: parsed.barangay_case_no ?? null,
    complaint_type: parsed.complaint_type ?? '',
    complainants: parsed.complainants ?? [],
    respondents: parsed.respondents ?? [],
    fraud: Boolean(parsed.fraud),
    fraud_details: parsed.fraud_details ?? '',
    violence: Boolean(parsed.violence),
    violence_details: parsed.violence_details ?? '',
    intimidation: Boolean(parsed.intimidation),
    intimidation_details: parsed.intimidation_details ?? '',
    sworn_on: parsed.sworn_on ?? '',
    received_and_filed_on: parsed.received_and_filed_on ?? '',
  }
}
