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

async function invokeRegistrationOtp<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('registration-otp', { body })

  if (error) {
    let message = error.message
    try {
      const response = (error as { context?: Response }).context
      if (response) {
        const parsed = (await response.json()) as { error?: string }
        if (parsed?.error) message = parsed.error
      }
    } catch {
      // keep the original message
    }
    throw new Error(message)
  }

  const parsed = data as { error?: string } & T
  if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error) {
    throw new Error(parsed.error)
  }

  return parsed
}

export async function sendRegistrationOtp(payload: {
  username: string
  email: string
  mobile_number: string
}): Promise<{ expires_at: string | null }> {
  const result = await invokeRegistrationOtp<{ ok?: boolean; expires_at?: string | null }>({
    action: 'send',
    username: payload.username,
    email: payload.email,
    mobile_number: payload.mobile_number,
  })
  return { expires_at: result.expires_at ?? null }
}

export async function verifyRegistrationOtp(
  payload: RegisterPayload & { otp: string },
): Promise<AuthSession> {
  const result = await invokeRegistrationOtp<{ session?: unknown }>({
    action: 'verify',
    ...payload,
  })
  return toSession(result.session)
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
