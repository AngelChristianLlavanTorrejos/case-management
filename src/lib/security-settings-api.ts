import { supabase } from '@/lib/supabase'

export type SecuritySettings = {
  is_locked_after_a_certain_login_attempts: boolean
  allow_login_attempts: number
  is_logout_after_a_certain_idle_minutes: boolean
  max_idle_minutes: number
  is_restrict_user_after_a_certain_inactive_days: boolean
  max_inactive_days: number
  is_allow_dual_login: boolean
  is_enable_min_length_password: boolean
  min_length_password: number
  is_enable_max_length_password: boolean
  max_length_password: number
  is_enable_min_lowercase: boolean
  min_lowercase: number
  is_enable_min_uppercase: boolean
  min_uppercase: number
  is_enable_min_numeric: boolean
  min_numeric: number
  is_enable_min_special_character: boolean
  min_special_character: number
  is_enable_password_must_not_match_username: boolean
  is_enable_password_must_not_contain_sequential: boolean
  is_enable_password_must_not_contain_repeated_char: boolean
}

export const emptySecuritySettings: SecuritySettings = {
  is_locked_after_a_certain_login_attempts: false,
  allow_login_attempts: 0,
  is_logout_after_a_certain_idle_minutes: false,
  max_idle_minutes: 0,
  is_restrict_user_after_a_certain_inactive_days: false,
  max_inactive_days: 0,
  is_allow_dual_login: false,
  is_enable_min_length_password: false,
  min_length_password: 0,
  is_enable_max_length_password: false,
  max_length_password: 0,
  is_enable_min_lowercase: false,
  min_lowercase: 0,
  is_enable_min_uppercase: false,
  min_uppercase: 0,
  is_enable_min_numeric: false,
  min_numeric: 0,
  is_enable_min_special_character: false,
  min_special_character: 0,
  is_enable_password_must_not_match_username: false,
  is_enable_password_must_not_contain_sequential: false,
  is_enable_password_must_not_contain_repeated_char: false,
}

function rpcError(message: string) {
  return new Error(message.replace(/^.*ERROR:\s*/i, ''))
}

function parseJson<T>(data: unknown): T {
  return (typeof data === 'string' ? JSON.parse(data) : data) as T
}

function asBoolean(value: unknown) {
  return Boolean(value)
}

function asNumber(value: unknown) {
  const next = Number(value)
  return Number.isFinite(next) ? next : 0
}

export function parseSecuritySettings(data: unknown): SecuritySettings {
  const parsed = parseJson<Partial<SecuritySettings>>(data)
  return {
    is_locked_after_a_certain_login_attempts: asBoolean(parsed.is_locked_after_a_certain_login_attempts),
    allow_login_attempts: asNumber(parsed.allow_login_attempts),
    is_logout_after_a_certain_idle_minutes: asBoolean(parsed.is_logout_after_a_certain_idle_minutes),
    max_idle_minutes: asNumber(parsed.max_idle_minutes),
    is_restrict_user_after_a_certain_inactive_days: asBoolean(
      parsed.is_restrict_user_after_a_certain_inactive_days,
    ),
    max_inactive_days: asNumber(parsed.max_inactive_days),
    is_allow_dual_login: asBoolean(parsed.is_allow_dual_login),
    is_enable_min_length_password: asBoolean(parsed.is_enable_min_length_password),
    min_length_password: asNumber(parsed.min_length_password),
    is_enable_max_length_password: asBoolean(parsed.is_enable_max_length_password),
    max_length_password: asNumber(parsed.max_length_password),
    is_enable_min_lowercase: asBoolean(parsed.is_enable_min_lowercase),
    min_lowercase: asNumber(parsed.min_lowercase),
    is_enable_min_uppercase: asBoolean(parsed.is_enable_min_uppercase),
    min_uppercase: asNumber(parsed.min_uppercase),
    is_enable_min_numeric: asBoolean(parsed.is_enable_min_numeric),
    min_numeric: asNumber(parsed.min_numeric),
    is_enable_min_special_character: asBoolean(parsed.is_enable_min_special_character),
    min_special_character: asNumber(parsed.min_special_character),
    is_enable_password_must_not_match_username: asBoolean(
      parsed.is_enable_password_must_not_match_username,
    ),
    is_enable_password_must_not_contain_sequential: asBoolean(
      parsed.is_enable_password_must_not_contain_sequential,
    ),
    is_enable_password_must_not_contain_repeated_char: asBoolean(
      parsed.is_enable_password_must_not_contain_repeated_char,
    ),
  }
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const { data, error } = await supabase.rpc('get_security_settings')
  if (error) throw rpcError(error.message)
  return parseSecuritySettings(data)
}

export async function updateSecuritySettings(
  values: SecuritySettings,
  actorUserId: number,
): Promise<SecuritySettings> {
  const { data, error } = await supabase.rpc('update_security_settings', {
    p_is_locked_after_a_certain_login_attempts: values.is_locked_after_a_certain_login_attempts,
    p_allow_login_attempts: values.allow_login_attempts,
    p_is_logout_after_a_certain_idle_minutes: values.is_logout_after_a_certain_idle_minutes,
    p_max_idle_minutes: values.max_idle_minutes,
    p_is_restrict_user_after_a_certain_inactive_days: values.is_restrict_user_after_a_certain_inactive_days,
    p_max_inactive_days: values.max_inactive_days,
    p_is_allow_dual_login: values.is_allow_dual_login,
    p_is_enable_min_length_password: values.is_enable_min_length_password,
    p_min_length_password: values.min_length_password,
    p_is_enable_max_length_password: values.is_enable_max_length_password,
    p_max_length_password: values.max_length_password,
    p_is_enable_min_lowercase: values.is_enable_min_lowercase,
    p_min_lowercase: values.min_lowercase,
    p_is_enable_min_uppercase: values.is_enable_min_uppercase,
    p_min_uppercase: values.min_uppercase,
    p_is_enable_min_numeric: values.is_enable_min_numeric,
    p_min_numeric: values.min_numeric,
    p_is_enable_min_special_character: values.is_enable_min_special_character,
    p_min_special_character: values.min_special_character,
    p_is_enable_password_must_not_match_username: values.is_enable_password_must_not_match_username,
    p_is_enable_password_must_not_contain_sequential: values.is_enable_password_must_not_contain_sequential,
    p_is_enable_password_must_not_contain_repeated_char:
      values.is_enable_password_must_not_contain_repeated_char,
    p_actor_user_id: actorUserId,
  })

  if (error) throw rpcError(error.message)
  return parseSecuritySettings(data)
}

export async function validateSession(userId: number, sessionToken: string | null): Promise<boolean> {
  const { data, error } = await supabase.rpc('validate_session', {
    p_user_id: userId,
    p_session_token: sessionToken,
  })

  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ valid?: boolean }>(data)
  return Boolean(parsed?.valid)
}
