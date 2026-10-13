import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const IPROG_SMS_URL = 'https://www.iprogsms.com/api/v1/sms_messages'
const GENERIC_MATCH_ERROR = 'Username and mobile number do not match our records.'
const NO_MOBILE_ERROR =
  'Password reset is not available. This account has no registered mobile number.'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function rpcErrorMessage(message: string) {
  return message.replace(/^.*ERROR:\s*/i, '')
}

function normalizePhMobile(raw: string) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.startsWith('09') && digits.length === 11) return digits
  if (digits.startsWith('639') && digits.length === 12) return `0${digits.slice(2)}`
  if (digits.startsWith('9') && digits.length === 10) return `0${digits}`
  throw new Error('Enter a valid mobile number (09XXXXXXXXX).')
}

function iprogToken() {
  const token = Deno.env.get('IPROG_SMS_API_TOKEN')
  if (!token) throw new Error('SMS is not configured.')
  return token
}

function serviceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase is not configured.')
  }
  return createClient(supabaseUrl, serviceKey)
}

function iprogAccepted(parsed: Record<string, unknown>, responseOk: boolean) {
  if (parsed.message_id != null || parsed.message_ids != null) return true

  const status = parsed.status
  if (status === 'success' || status === 200 || status === '200') return true

  const statusNumber = typeof status === 'number' ? status : Number(status)
  const failedStatus =
    status === 'error' ||
    status === 'failed' ||
    status === false ||
    (Number.isFinite(statusNumber) && statusNumber >= 400)

  return responseOk && !failedStatus
}

async function iprogSend(phoneNumber: string, message: string) {
  const payload = {
    api_token: iprogToken(),
    phone_number: phoneNumber,
    message,
  }

  const response = await fetch(IPROG_SMS_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const text = await response.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 180)
    throw new Error(
      snippet
        ? `Unable to reach the SMS provider (${response.status}): ${snippet}`
        : `Unable to reach the SMS provider (${response.status}).`,
    )
  }

  if (iprogAccepted(parsed, response.ok)) return

  const bodyStatus = parsed.status
  const errorMessage =
    typeof parsed.message === 'string' && parsed.message.trim()
      ? parsed.message
      : `Unable to send SMS (${bodyStatus ?? response.status}).`
  throw new Error(errorMessage)
}

function parseRpcJson(data: unknown): Record<string, unknown> | null {
  if (data == null) return null
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>
    } catch {
      throw new Error('Unable to reset password.')
    }
  }
  if (typeof data === 'object') return data as Record<string, unknown>
  throw new Error('Unable to reset password.')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = (await req.json()) as Record<string, unknown>
    const username = String(body.username ?? '').trim()
    const mobile = normalizePhMobile(String(body.mobile_number ?? ''))

    if (username.length < 3) {
      throw new Error(GENERIC_MATCH_ERROR)
    }

    const supabase = serviceClient()

    const verified = await supabase.rpc('verify_password_reset_request', {
      p_username: username,
      p_mobile: mobile,
    })
    if (verified.error) throw new Error(rpcErrorMessage(verified.error.message))

    const info = parseRpcJson(verified.data)
    const userId = Number(info?.user_id)
    const storedUsername = String(info?.username ?? username)
    const storedMobile = String(info?.mobile_number ?? mobile)
    if (!Number.isFinite(userId)) throw new Error(GENERIC_MATCH_ERROR)

    const generated = await supabase.rpc('generate_compliant_password', {
      p_username: storedUsername,
    })
    if (generated.error) throw new Error(rpcErrorMessage(generated.error.message))

    const password = String(generated.data ?? '').trim()
    if (!password) throw new Error('Unable to reset password.')

    const applied = await supabase.rpc('apply_password_reset', {
      p_user_id: userId,
      p_new_password: password,
    })
    if (applied.error) throw new Error(rpcErrorMessage(applied.error.message))

    try {
      await iprogSend(
        storedMobile,
        `Tanza 1: Your temporary password is ${password}. Sign in and change your password in My Profile.`,
      )
    } catch (error) {
      return jsonResponse({
        ok: true,
        partial: true,
        error:
          error instanceof Error
            ? error.message
            : 'Password was reset but the SMS could not be sent.',
      })
    }

    return jsonResponse({ ok: true })
  } catch (error) {
    const raw = error instanceof Error ? error.message : GENERIC_MATCH_ERROR
    const message =
      raw.includes('no registered mobile number')
        ? NO_MOBILE_ERROR
        : raw.includes('do not match our records')
          ? GENERIC_MATCH_ERROR
          : raw
    return jsonResponse({ error: message }, 400)
  }
})
