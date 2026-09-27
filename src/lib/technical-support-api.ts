import { supabase } from '@/lib/supabase'
import type { RegisterPayload } from '@/lib/auth-api'

export type TechnicalSupportListRow = {
  id: number
  display_name: string
  role_name: string
  username: string
  status_name: string
}

export type TechnicalSupport = {
  id: number
  username: string
  status_name: string
  role_name: string
  display_name: string
  first_name: string
  middle_name: string
  last_name: string
  suffix_id: number
  suffix_name: string
  sex_id: number
  sex_name: string
  civil_status_id: number
  civil_status_name: string
  birthdate: string
  age: number | null
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
}

export type TechnicalSupportUpdate = {
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
}

export type TechnicalSupportListQuery = {
  search: string
  sortKey: string
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number
}

export type TechnicalSupportListResult = {
  rows: TechnicalSupportListRow[]
  total: number
}

function rpcError(message: string) {
  return new Error(message.replace(/^.*ERROR:\s*/i, ''))
}

function parseJson<T>(data: unknown): T {
  return (typeof data === 'string' ? JSON.parse(data) : data) as T
}

export async function listTechnicalSupport(
  query: TechnicalSupportListQuery,
): Promise<TechnicalSupportListResult> {
  const { data, error } = await supabase.rpc('list_technical_support', {
    p_search: query.search,
    p_sort_key: query.sortKey,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<TechnicalSupportListResult>(data)
  return {
    rows: parsed?.rows ?? [],
    total: parsed?.total ?? 0,
  }
}

export async function createTechnicalSupport(
  actorUserId: number,
  payload: RegisterPayload,
): Promise<{ id: number }> {
  const { data, error } = await supabase.rpc('create_technical_support', {
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
  if (!parsed?.id) throw new Error('Technical support account was not saved.')
  return { id: parsed.id }
}

export async function getTechnicalSupport(id: number): Promise<TechnicalSupport> {
  const { data, error } = await supabase.rpc('get_technical_support', { p_id: id })
  if (error) throw rpcError(error.message)
  return parseJson<TechnicalSupport>(data)
}

export async function updateTechnicalSupport(
  id: number,
  values: TechnicalSupportUpdate,
  actorUserId: number,
): Promise<void> {
  const { error } = await supabase.rpc('update_technical_support', {
    p_id: id,
    p_first_name: values.first_name,
    p_middle_name: values.middle_name,
    p_last_name: values.last_name,
    p_suffix_id: values.suffix_id,
    p_sex_id: values.sex_id,
    p_civil_status_id: values.civil_status_id,
    p_birthdate: values.birthdate,
    p_present_address_house_block_lot: values.present_address_house_block_lot,
    p_present_address_street: values.present_address_street,
    p_present_address_barangay: values.present_address_barangay,
    p_present_address_municipality_city: values.present_address_municipality_city,
    p_present_address_province: values.present_address_province,
    p_present_address_region: values.present_address_region,
    p_present_address_zip_code: values.present_address_zip_code,
    p_permanent_address_house_block_lot: values.permanent_address_house_block_lot,
    p_permanent_address_street: values.permanent_address_street,
    p_permanent_address_barangay: values.permanent_address_barangay,
    p_permanent_address_municipality_city: values.permanent_address_municipality_city,
    p_permanent_address_province: values.permanent_address_province,
    p_permanent_address_region: values.permanent_address_region,
    p_permanent_address_zip_code: values.permanent_address_zip_code,
    p_mobile_number: values.mobile_number,
    p_telephone_number: values.telephone_number,
    p_email: values.email,
    p_actor_user_id: actorUserId,
  })
  if (error) throw rpcError(error.message)
}

export async function restrictTechnicalSupport(id: number, actorUserId: number): Promise<void> {
  const { error } = await supabase.rpc('restrict_technical_support', {
    p_id: id,
    p_actor_user_id: actorUserId,
  })
  if (error) throw rpcError(error.message)
}

export async function allowTechnicalSupport(id: number, actorUserId: number): Promise<void> {
  const { error } = await supabase.rpc('allow_technical_support', {
    p_id: id,
    p_actor_user_id: actorUserId,
  })
  if (error) throw rpcError(error.message)
}

export async function deleteTechnicalSupport(id: number, actorUserId: number): Promise<void> {
  const { error } = await supabase.rpc('delete_technical_support', {
    p_id: id,
    p_actor_user_id: actorUserId,
  })
  if (error) throw rpcError(error.message)
}
