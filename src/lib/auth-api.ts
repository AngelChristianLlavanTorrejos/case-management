import { supabase } from '@/lib/supabase'
import type { AuthSession, RegisterLookups } from '@/types/auth'

type AuthRpcResult = {
  id: number
  username: string
  role_name: string
  status_name: string
  display_name?: string
  session_token?: string | null
}

export type RegisterPayload = {
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

function toSession(data: unknown): AuthSession {
  const parsed = typeof data === 'string' ? (JSON.parse(data) as AuthRpcResult) : (data as AuthRpcResult)

  if (!parsed?.username || !parsed.role_name) {
    throw new Error('Login did not return a valid user session.')
  }

  return {
    id: parsed.id,
    username: parsed.username,
    displayName: parsed.display_name || parsed.username,
    roleName: parsed.role_name,
    statusName: parsed.status_name,
    sessionToken: parsed.session_token ?? null,
  }
}

export async function loginUser(username: string, password: string): Promise<AuthSession> {
  const { data, error } = await supabase.rpc('login_user', {
    p_username: username,
    p_password: password,
  })

  if (error) {
    throw new Error(error.message.replace(/^.*ERROR:\s*/i, ''))
  }

  const parsed =
    typeof data === 'string'
      ? (JSON.parse(data) as AuthRpcResult & { error?: string })
      : (data as AuthRpcResult & { error?: string })

  if (parsed?.error) {
    throw new Error(parsed.error)
  }

  return toSession(parsed)
}

export async function logoutUser(userId: number): Promise<void> {
  const { error } = await supabase.rpc('logout_user', {
    p_user_id: userId,
  })

  if (error) {
    throw new Error(error.message.replace(/^.*ERROR:\s*/i, ''))
  }
}

export async function registerUser(payload: RegisterPayload): Promise<AuthSession> {
  const { data, error } = await supabase.rpc('register_user', {
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

  if (error) {
    throw new Error(error.message.replace(/^.*ERROR:\s*/i, ''))
  }

  return toSession(data)
}

export async function getUserProfile(userId: number): Promise<{ displayName: string; roleName: string }> {
  const { data, error } = await supabase.rpc('get_user_profile', {
    p_user_id: userId,
  })

  if (error) {
    throw new Error(error.message.replace(/^.*ERROR:\s*/i, ''))
  }

  const parsed =
    typeof data === 'string'
      ? (JSON.parse(data) as { display_name?: string; role_name?: string })
      : (data as { display_name?: string; role_name?: string })

  if (!parsed?.display_name) {
    throw new Error('Unable to load user profile.')
  }

  return {
    displayName: parsed.display_name,
    roleName: parsed.role_name ?? '',
  }
}

export async function getRegisterLookups(): Promise<RegisterLookups> {
  const [suffixes, sexes, civilStatuses] = await Promise.all([
    supabase.from('suffixes').select('id, name').order('id'),
    supabase.from('sex').select('id, name').order('id'),
    supabase.from('civil_status').select('id, name').order('id'),
  ])

  if (suffixes.error) throw new Error(suffixes.error.message)
  if (sexes.error) throw new Error(sexes.error.message)
  if (civilStatuses.error) throw new Error(civilStatuses.error.message)

  return {
    suffixes: suffixes.data ?? [],
    sexes: sexes.data ?? [],
    civilStatuses: civilStatuses.data ?? [],
  }
}
