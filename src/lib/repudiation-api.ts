import { notifyComplaintSms } from '@/lib/complaint-sms'
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
  is_received_and_filed: boolean
  received_and_filed_on: string | null
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
  received_and_filed_on: string | null
  received_and_filed_by_name: string
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
  receivedAndFiledOn?: string | null
}

type ListQuery = {
  actorUserId: number
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

export async function listRepudiationCases(actorUserId: number): Promise<RepudiationCaseOption[]> {
  const { data, error } = await supabase.rpc('list_repudiation_cases', {
    p_actor_user_id: actorUserId,
  })
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
    p_received_and_filed_on: payload.receivedAndFiledOn || null,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ id?: number }>(data)
  if (!parsed?.id) throw new Error('Repudiation was not saved.')

  if (payload.receivedAndFiledOn) {
    await notifyComplaintSms('repudiation_received_and_filed', payload.complaintId)
  } else {
    await notifyComplaintSms('repudiation_filed', payload.complaintId)
  }

  return { id: parsed.id }
}

export async function listRepudiations(query: ListQuery) {
  const { data, error } = await supabase.rpc('list_repudiations', {
    p_search: query.search,
    p_sort_key: query.sortKey,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
    p_actor_user_id: query.actorUserId,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ rows: RepudiationListRow[]; total: number }>(data)
  const rows = (parsed?.rows ?? []).map((row) => ({
    ...row,
    is_received_and_filed: Boolean(row.is_received_and_filed ?? row.received_and_filed_on),
    received_and_filed_on: row.received_and_filed_on ?? null,
  }))
  return { rows, total: parsed?.total ?? 0 }
}

export async function markRepudiationReceivedAndFiled(
  id: number,
  actorUserId: number,
  complaintId: number,
): Promise<void> {
  const { error } = await supabase.rpc('mark_repudiation_received_and_filed', {
    p_id: id,
    p_actor_user_id: actorUserId,
  })
  if (error) throw rpcError(error.message)
  await notifyComplaintSms('repudiation_received_and_filed', complaintId)
}

export async function getRepudiation(id: number, actorUserId: number): Promise<RepudiationRecord> {
  const { data, error } = await supabase.rpc('get_repudiation', {
    p_id: id,
    p_actor_user_id: actorUserId,
  })
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
    received_and_filed_on: parsed.received_and_filed_on ?? null,
    received_and_filed_by_name: parsed.received_and_filed_by_name ?? '',
  }
}
