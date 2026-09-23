import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const IPROG_SEND_URL = 'https://www.iprogsms.com/api/v1/otp/send_otp'
const IPROG_VERIFY_URL = 'https://www.iprogsms.com/api/v1/otp/verify_otp'

type RegisterPayload = {
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

function createAnonClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase is not configured.')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') ?? `Bearer ${supabaseAnonKey}` },
    },
  })
}

async function iprogJson(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const text = await response.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    throw new Error('Unable to reach the SMS provider.')
  }

  const status = parsed.status
  const ok = status === 'success' || status === 200
  if (!response.ok || !ok) {
    const message = typeof parsed.message === 'string' ? parsed.message : 'Unable to complete SMS verification.'
    throw new Error(message)
  }

  return parsed
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
    const action = body.action
    const supabase = createAnonClient(req)

    if (action === 'send') {
      const mobile = normalizePhMobile(String(body.mobile_number ?? ''))
      const username = String(body.username ?? '').trim()
      const email = String(body.email ?? '').trim()

      const available = await supabase.rpc('assert_registration_available', {
        p_username: username,
        p_email: email,
        p_mobile_number: mobile,
      })
      if (available.error) throw new Error(rpcErrorMessage(available.error.message))

      const sent = await iprogJson(IPROG_SEND_URL, {
        api_token: iprogToken(),
        phone_number: mobile,
        expires_in_minutes: 5,
      })

      const data = (sent.data ?? {}) as Record<string, unknown>
      return jsonResponse({
        ok: true,
        phone_number: mobile,
        expires_at: data.otp_code_expires_at ?? null,
      })
    }

    if (action === 'verify') {
      const payload = body as unknown as RegisterPayload & { otp?: string }
      const mobile = normalizePhMobile(payload.mobile_number)
      const otp = String(payload.otp ?? '').trim()

      if (!/^\d{4,8}$/.test(otp)) {
        throw new Error('Enter the OTP sent to your mobile number.')
      }

      await iprogJson(IPROG_VERIFY_URL, {
        api_token: iprogToken(),
        phone_number: mobile,
        otp,
      })

      const registered = await supabase.rpc('register_user', {
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
        p_mobile_number: mobile,
        p_telephone_number: payload.telephone_number ?? '',
        p_email: payload.email,
        p_username: payload.username,
        p_password: payload.password,
      })
      if (registered.error) throw new Error(rpcErrorMessage(registered.error.message))

      const loggedIn = await supabase.rpc('login_user', {
        p_username: payload.username,
        p_password: payload.password,
      })
      if (loggedIn.error) throw new Error(rpcErrorMessage(loggedIn.error.message))

      const session =
        typeof loggedIn.data === 'string' ? JSON.parse(loggedIn.data) : loggedIn.data
      if (session?.error) throw new Error(String(session.error))

      return jsonResponse({ ok: true, session })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete registration.'
    return jsonResponse({ error: message }, 400)
  }
})
