import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const IPROG_SMS_URL = 'https://www.iprogsms.com/api/v1/sms/send'

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
  throw new Error('The filer has no valid mobile number.')
}

function iprogToken() {
  const token = Deno.env.get('IPROG_SMS_API_TOKEN')
  if (!token) throw new Error('SMS is not configured.')
  return token
}

function formatAppearWhen(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function buildMessage(kind: string, caseNo: string, appearAt: string | null) {
  if (kind === 'received_and_filed') {
    return `Tanza 1: Your complaint is now Received and Filed. Case no. ${caseNo}. A Notice of Hearing will be issued within 3 days.`
  }

  if (kind === 'notice_of_hearing') {
    const when = formatAppearWhen(appearAt)
    return `Tanza 1: Notice of Hearing for case ${caseNo}. Please appear on ${when} at the Barangay Hall. Bring this case no.`
  }

  throw new Error('Unknown notification.')
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

async function iprogSend(phoneNumber: string, message: string) {
  const response = await fetch(IPROG_SMS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_token: iprogToken(),
      phone_number: phoneNumber,
      message,
    }),
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
    const errorMessage = typeof parsed.message === 'string' ? parsed.message : 'Unable to send SMS.'
    throw new Error(errorMessage)
  }
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
    const kind = String(body.kind ?? '')
    const complaintId = Number(body.complaint_id)

    if (!Number.isFinite(complaintId)) {
      throw new Error('Complaint not found')
    }

    const supabase = createAnonClient(req)
    const info = await supabase.rpc('get_complaint_notify_info', { p_id: complaintId })
    if (info.error) throw new Error(rpcErrorMessage(info.error.message))

    const parsed =
      typeof info.data === 'string' ? JSON.parse(info.data) : (info.data as Record<string, unknown> | null)
    const caseNo = String(parsed?.barangay_case_no ?? '').trim()
    const rawMobile = String(parsed?.mobile_number ?? '').trim()
    const appearAt = parsed?.appear_at ? String(parsed.appear_at) : null

    if (!caseNo) throw new Error('This complaint has no case number yet.')
    if (!rawMobile) return jsonResponse({ ok: true, skipped: 'no_mobile' })

    const mobile = normalizePhMobile(rawMobile)
    await iprogSend(mobile, buildMessage(kind, caseNo, appearAt))

    return jsonResponse({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send SMS.'
    return jsonResponse({ error: message }, 400)
  }
})
