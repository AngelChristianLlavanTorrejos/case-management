import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const IPROG_SMS_URL = 'https://www.iprogsms.com/api/v1/sms_messages'

const DUAL_PARTY_KINDS = new Set([
  'repudiation_filed',
  'repudiation_received_and_filed',
  'amicable_settlement_recorded',
  'settlement_settled',
  'motion_for_execution_created',
  'notice_of_hearing_motion',
  'notice_of_execution',
  'certificate_to_file_action',
])

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

function ordinalDay(day: number) {
  const remainder = day % 100
  if (remainder >= 11 && remainder <= 13) return `${day}th`
  switch (day % 10) {
    case 1:
      return `${day}st`
    case 2:
      return `${day}nd`
    case 3:
      return `${day}rd`
    default:
      return `${day}th`
  }
}

function manilaAppearParts(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  const day = Number(read('day'))
  const minute = read('minute')
  const hour = read('hour')
  if (!day || !hour) return null
  const dayPeriod = read('dayPeriod').toLowerCase()

  return {
    day: ordinalDay(day),
    month: read('month'),
    year: read('year'),
    time: minute === '00' ? hour : `${hour}:${minute}`,
    period: dayPeriod.startsWith('a') ? 'morning' : 'afternoon',
  }
}

function buildMessage(kind: string, caseNo: string, appearAt: string | null, complainants: string) {
  if (kind === 'received_and_filed') {
    return `Tanza 1: Your complaint is now Received and Filed. Case no. ${caseNo}. A Notice of Hearing will be issued within 3 days.`
  }

  if (kind === 'repudiation_filed') {
    return `Tanza 1: A repudiation was filed for case ${caseNo}. It is pending Received and Filed.`
  }

  if (kind === 'repudiation_received_and_filed') {
    return `Tanza 1: Your repudiation is now Received and Filed. Case no. ${caseNo}.`
  }

  if (kind === 'amicable_settlement_recorded') {
    return `Tanza 1: An amicable settlement was recorded for case ${caseNo}. You may file a repudiation within 10 days.`
  }

  if (kind === 'settlement_settled') {
    return `Tanza 1: The amicable settlement for case ${caseNo} is now Settled.`
  }

  if (kind === 'motion_for_execution_created') {
    return `Tanza 1: A Motion for Execution was filed for case ${caseNo}.`
  }

  if (kind === 'notice_of_hearing_motion') {
    const when = manilaAppearParts(appearAt)
    if (when) {
      return `Tanza 1: NOTICE OF HEARING (RE: Motion for Execution) for case ${caseNo}. Appear on the ${when.day} day of ${when.month}, ${when.year} at ${when.time} o'clock in the ${when.period}.`
    }
    return `Tanza 1: NOTICE OF HEARING (RE: Motion for Execution) was issued for case ${caseNo}.`
  }

  if (kind === 'notice_of_execution') {
    return `Tanza 1: A Notice of Execution was issued for case ${caseNo}.`
  }

  if (kind === 'certificate_to_file_action') {
    return `Tanza 1: A Certificate to File Action was issued for case ${caseNo}.`
  }

  if (kind === 'notice_of_hearing') {
    const when = manilaAppearParts(appearAt)
    if (!when) throw new Error('Hearing schedule is missing.')
    const names = complainants.trim() || 'Complainant'
    return `Tanza 1: NOTICE OF HEARING (MEDIATION PROCEEDINGS) for case ${caseNo}. To: ${names}. You are hereby required to appear before me on the ${when.day} day of ${when.month}, ${when.year} at ${when.time} o'clock in the ${when.period} for the hearing of your complaint.`
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
  const payload = {
    api_token: iprogToken(),
    phone_number: phoneNumber,
    message,
  }
  const url = new URL(IPROG_SMS_URL)
  url.searchParams.set('api_token', payload.api_token)
  url.searchParams.set('phone_number', payload.phone_number)
  url.searchParams.set('message', payload.message)

  const response = await fetch(url, {
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
    throw new Error('Unable to reach the SMS provider.')
  }

  const status = parsed.status
  const ok = status === 'success' || status === 200 || status === '200'
  if (!response.ok || !ok) {
    const errorMessage = typeof parsed.message === 'string' ? parsed.message : 'Unable to send SMS.'
    throw new Error(errorMessage)
  }
}

async function sendDualPartySms(
  supabase: ReturnType<typeof createAnonClient>,
  kind: string,
  complaintId: number,
  appearAt: string | null,
) {
  const info = await supabase.rpc('get_repudiation_notify_info', {
    p_complaint_id: complaintId,
  })
  if (info.error) throw new Error(rpcErrorMessage(info.error.message))

  const parsed =
    typeof info.data === 'string' ? JSON.parse(info.data) : (info.data as Record<string, unknown> | null)
  const caseNo = String(parsed?.barangay_case_no ?? '').trim()
  const creatorRole = String(parsed?.creator_role ?? '').trim()
  const recipients = Array.isArray(parsed?.recipients)
    ? (parsed.recipients as Array<{ mobile_number?: string }>)
    : []

  if (creatorRole && creatorRole !== 'User') {
    return jsonResponse({ ok: true, skipped: 'staff_created' })
  }
  if (!caseNo) throw new Error('This complaint has no case number yet.')

  const mobiles = [
    ...new Set(
      recipients
        .map((item) => String(item?.mobile_number ?? '').trim())
        .filter(Boolean)
        .map((raw) => normalizePhMobile(raw)),
    ),
  ]
  if (mobiles.length === 0) return jsonResponse({ ok: true, skipped: 'no_mobile' })

  const message = buildMessage(kind, caseNo, appearAt, '')
  for (const mobile of mobiles) {
    await iprogSend(mobile, message)
  }
  return jsonResponse({ ok: true, sent: mobiles.length })
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
    const bodyAppearAt = body.appear_at ? String(body.appear_at) : null

    if (!Number.isFinite(complaintId)) {
      throw new Error('Complaint not found')
    }

    const supabase = createAnonClient(req)

    if (DUAL_PARTY_KINDS.has(kind)) {
      return await sendDualPartySms(supabase, kind, complaintId, bodyAppearAt)
    }

    const info = await supabase.rpc('get_complaint_notify_info', { p_id: complaintId })
    if (info.error) throw new Error(rpcErrorMessage(info.error.message))

    const parsed =
      typeof info.data === 'string' ? JSON.parse(info.data) : (info.data as Record<string, unknown> | null)
    const caseNo = String(parsed?.barangay_case_no ?? '').trim()
    const rawMobile = String(parsed?.mobile_number ?? '').trim()
    const appearAt = bodyAppearAt ?? (parsed?.appear_at ? String(parsed.appear_at) : null)
    const complainants = String(parsed?.complainants ?? '').trim()
    const creatorRole = String(parsed?.creator_role ?? '').trim()

    // Staff-created cases: no SMS (filer is lupon/staff, not a community User).
    if (creatorRole && creatorRole !== 'User') {
      return jsonResponse({ ok: true, skipped: 'staff_created' })
    }

    if (!caseNo) throw new Error('This complaint has no case number yet.')
    if (!rawMobile) return jsonResponse({ ok: true, skipped: 'no_mobile' })

    const mobile = normalizePhMobile(rawMobile)
    await iprogSend(mobile, buildMessage(kind, caseNo, appearAt, complainants))

    return jsonResponse({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send SMS.'
    return jsonResponse({ error: message }, 400)
  }
})
