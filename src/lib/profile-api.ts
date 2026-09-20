import { supabase } from '@/lib/supabase'
import type { CommunityMemberUpdate } from '@/lib/community-members-api'

export type OwnProfile = CommunityMemberUpdate & {
  id: number
  username: string
  role_name: string
  status_name: string
  display_name: string
  suffix_name: string
  sex_name: string
  civil_status_name: string
  birthdate: string
  age: number | null
}

function rpcError(message: string) {
  return new Error(message.replace(/^.*ERROR:\s*/i, ''))
}

function parseJson<T>(data: unknown): T {
  return (typeof data === 'string' ? JSON.parse(data) : data) as T
}

export async function getOwnProfile(actorUserId: number): Promise<OwnProfile> {
  const { data, error } = await supabase.rpc('get_own_profile', { p_actor_user_id: actorUserId })
  if (error) throw rpcError(error.message)
  return parseJson<OwnProfile>(data)
}

export async function updateOwnProfile(
  actorUserId: number,
  values: CommunityMemberUpdate,
): Promise<OwnProfile> {
  const { data, error } = await supabase.rpc('update_own_profile', {
    p_actor_user_id: actorUserId,
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
  return parseJson<OwnProfile>(data)
}

export async function changeOwnPassword(
  actorUserId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const { error } = await supabase.rpc('change_own_password', {
    p_actor_user_id: actorUserId,
    p_current_password: currentPassword,
    p_new_password: newPassword,
  })

  if (error) throw rpcError(error.message)
}
