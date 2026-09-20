import { supabase } from '@/lib/supabase'

export type CommunityMemberStatusGroup = 'residents' | 'requests'

export type CommunityMemberListRow = {
  id: number
  display_name: string
  age: number | null
  sex_name: string
  location: string
  status_name: string
}

export type CommunityMemberListQuery = {
  statusGroup: CommunityMemberStatusGroup
  search: string
  sortKey: string
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number
}

export type CommunityMemberListResult = {
  rows: CommunityMemberListRow[]
  total: number
}

export type CommunityMember = {
  id: number
  username: string
  status_name: string
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
  location: string
}

export type CommunityMemberUpdate = {
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

function rpcError(message: string) {
  return new Error(message.replace(/^.*ERROR:\s*/i, ''))
}

function parseJson<T>(data: unknown): T {
  return (typeof data === 'string' ? JSON.parse(data) : data) as T
}

export async function listCommunityMembers(
  query: CommunityMemberListQuery,
): Promise<CommunityMemberListResult> {
  const { data, error } = await supabase.rpc('list_community_members', {
    p_status_group: query.statusGroup,
    p_search: query.search,
    p_sort_key: query.sortKey,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })

  if (error) throw rpcError(error.message)

  const parsed = parseJson<CommunityMemberListResult>(data)

  return {
    rows: parsed?.rows ?? [],
    total: parsed?.total ?? 0,
  }
}

export async function getCommunityMember(id: number): Promise<CommunityMember> {
  const { data, error } = await supabase.rpc('get_community_member', { p_id: id })
  if (error) throw rpcError(error.message)
  return parseJson<CommunityMember>(data)
}

export async function approveCommunityMember(id: number): Promise<void> {
  const { error } = await supabase.rpc('approve_community_member', { p_id: id })
  if (error) throw rpcError(error.message)
}

export async function disapproveCommunityMember(id: number): Promise<void> {
  const { error } = await supabase.rpc('disapprove_community_member', { p_id: id })
  if (error) throw rpcError(error.message)
}

export async function restrictCommunityMember(id: number): Promise<void> {
  const { error } = await supabase.rpc('restrict_community_member', { p_id: id })
  if (error) throw rpcError(error.message)
}

export async function deleteCommunityMember(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_community_member', { p_id: id })
  if (error) throw rpcError(error.message)
}

export async function updateCommunityMember(
  id: number,
  values: CommunityMemberUpdate,
): Promise<void> {
  const { error } = await supabase.rpc('update_community_member', {
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
  })

  if (error) throw rpcError(error.message)
}
