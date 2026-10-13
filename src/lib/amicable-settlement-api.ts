import { notifyComplaintSms } from '@/lib/complaint-sms'
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
  requires_respondent_account: boolean
}

export type CreateCaseRespondentPayload = {
  first_name: string
  middle_name: string
  last_name: string
  suffix_id: number
  sex_id: number
  civil_status_id: number
  birthdate: string
  present_address_house_block_lot: string
  present_address_street: string
  present_address_barangay: string
  present_address_municipality_city: string
  present_address_province: string
  present_address_region: string
  present_address_zip_code: string
  permanent_address_house_block_lot: string
  permanent_address_street: string
  permanent_address_barangay: string
  permanent_address_municipality_city: string
  permanent_address_province: string
  permanent_address_region: string
  permanent_address_zip_code: string
  mobile_number: string
  telephone_number: string
  email: string
  username: string
  password: string
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
): Promise<{ id: number; complaint_id: number; requires_respondent_account: boolean }> {
  const { data, error } = await supabase.rpc('create_amicable_settlement', {
    p_complaint_id: complaintId,
    p_actor_user_id: actorUserId,
    p_terms: terms,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{
    id?: number
    complaint_id?: number
    requires_respondent_account?: boolean
  }>(data)
  if (!parsed?.id) throw new Error('Amicable settlement was not saved.')
  const result = {
    id: parsed.id,
    complaint_id: parsed.complaint_id ?? complaintId,
    requires_respondent_account: Boolean(parsed.requires_respondent_account),
  }
  await notifyComplaintSms('amicable_settlement_recorded', result.complaint_id)
  return result
}

export type LinkableCaseRespondentOption = {
  id: number
  display_name: string
  username: string
  mobile_number: string
}

export async function listLinkableCaseRespondents(
  complaintId: number,
  actorUserId: number,
  search = '',
): Promise<LinkableCaseRespondentOption[]> {
  const { data, error } = await supabase.rpc('list_linkable_case_respondents', {
    p_complaint_id: complaintId,
    p_actor_user_id: actorUserId,
    p_search: search,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<LinkableCaseRespondentOption[]>(data)
  return parsed ?? []
}

export async function linkExistingCaseRespondent(
  complaintId: number,
  actorUserId: number,
  userId: number,
): Promise<{ id: number }> {
  const { data, error } = await supabase.rpc('link_existing_case_respondent', {
    p_complaint_id: complaintId,
    p_actor_user_id: actorUserId,
    p_user_id: userId,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ id?: number }>(data)
  if (!parsed?.id) throw new Error('Respondent account was not linked.')
  return { id: parsed.id }
}

export async function createAndLinkCaseRespondent(
  complaintId: number,
  actorUserId: number,
  payload: CreateCaseRespondentPayload,
): Promise<{ id: number }> {
  const { data, error } = await supabase.rpc('create_and_link_case_respondent', {
    p_complaint_id: complaintId,
    p_actor_user_id: actorUserId,
    p_first_name: payload.first_name,
    p_middle_name: payload.middle_name,
    p_last_name: payload.last_name,
    p_suffix_id: payload.suffix_id,
    p_sex_id: payload.sex_id,
    p_civil_status_id: payload.civil_status_id,
    p_birthdate: payload.birthdate,
    p_present_address_house_block_lot: payload.present_address_house_block_lot,
    p_present_address_street: payload.present_address_street,
    p_present_address_barangay: payload.present_address_barangay,
    p_present_address_municipality_city: payload.present_address_municipality_city,
    p_present_address_province: payload.present_address_province,
    p_present_address_region: payload.present_address_region,
    p_present_address_zip_code: payload.present_address_zip_code,
    p_permanent_address_house_block_lot: payload.permanent_address_house_block_lot,
    p_permanent_address_street: payload.permanent_address_street,
    p_permanent_address_barangay: payload.permanent_address_barangay,
    p_permanent_address_municipality_city: payload.permanent_address_municipality_city,
    p_permanent_address_province: payload.permanent_address_province,
    p_permanent_address_region: payload.permanent_address_region,
    p_permanent_address_zip_code: payload.permanent_address_zip_code,
    p_mobile_number: payload.mobile_number,
    p_telephone_number: payload.telephone_number,
    p_email: payload.email,
    p_username: payload.username,
    p_password: payload.password,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ id?: number }>(data)
  if (!parsed?.id) throw new Error('Respondent account was not saved.')
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
      requires_respondent_account: Boolean(row.requires_respondent_account),
    })),
    total: parsed?.total ?? 0,
  }
}

export async function markAmicableSettlementSettled(
  id: number,
  actorUserId: number,
  complaintId: number,
) {
  const { error } = await supabase.rpc('mark_amicable_settlement_settled', {
    p_id: id,
    p_actor_user_id: actorUserId,
  })
  if (error) throw rpcError(error.message)
  await notifyComplaintSms('settlement_settled', complaintId)
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
