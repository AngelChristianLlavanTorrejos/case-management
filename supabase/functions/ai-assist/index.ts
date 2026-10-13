import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-5-nano'
const MAX_DRAFT = 1500

const DASHBOARD_QUESTIONS = [
  'How many complaints were filed this month?',
  'Which cases missed the 3-day notice or summons deadline?',
  'Which summons are still not served?',
  'How many settlements are inside the 10-day repudiation window?',
  'How many were complied vs repudiated vs in execution?',
  'Which settlements can already have a motion for execution?',
  'Which cases are due for a Notice of Execution?',
] as const

const FACT_KEYS = [
  'complaints_filed_this_month',
  'notice_deadline_missed',
  'summons_unserved',
  'repudiation_window',
  'mix',
  'motion_for_execution_ready',
  'notice_of_execution_due',
] as const

const ENHANCE_FIELDS = {
  manner: 'how the respondent violated the complainant’s rights',
  relief: 'the relief the complainant is asking for',
  fraud: 'repudiation details for fraud',
  violence: 'repudiation details for violence',
  intimidation: 'repudiation details for intimidation',
  settlement_terms: 'amicable settlement terms',
} as const

type EnhanceField = keyof typeof ENHANCE_FIELDS

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function rpcErrorMessage(message: string) {
  return message.replace(/^.*ERROR:\s*/i, '')
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

function parseJson(data: unknown) {
  return typeof data === 'string' ? JSON.parse(data) : data
}

function messageText(content: unknown) {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && 'text' in part) {
        return String((part as { text?: unknown }).text ?? '')
      }
      return ''
    })
    .join('')
    .trim()
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Present DB facts in plain office language so the model never echoes column names. */
function humanizeDashboardFacts(factKey: string, fact: unknown, period: string) {
  const periodLabel = period === 'year' ? 'this year' : 'this month'

  if (typeof fact === 'number') {
    return {
      topic: 'Complaints filed',
      period: periodLabel,
      count: fact,
    }
  }

  const record = asRecord(fact)
  if (!record) return { topic: factKey, details: fact }

  if (factKey === 'mix') {
    return {
      topic: 'Settlement outcomes',
      period: record.period === 'year' ? 'this year' : 'this month',
      settledCount: Number(record.complied ?? 0),
      repudiatedCount: Number(record.repudiated ?? 0),
      inExecutionCount: Number(record.in_execution ?? 0),
    }
  }

  const caseNumbers = Array.isArray(record.case_nos)
    ? record.case_nos.map((item) => String(item))
    : []
  const total = Number(record.total ?? caseNumbers.length)

  const topics: Record<string, string> = {
    notice_deadline_missed: 'Cases that missed the 3-day notice or summon deadline',
    summons_unserved: 'Summons not yet served',
    repudiation_window: 'Settlements still inside the 10-day repudiation window',
    motion_for_execution_ready: 'Settlements ready for a motion for execution',
    notice_of_execution_due: 'Cases due for a notice of execution',
  }

  return {
    topic: topics[factKey] ?? 'Dashboard result',
    period: periodLabel,
    totalCount: total,
    barangayCaseNumbersListed: caseNumbers,
    additionalCasesNotListed: Math.max(0, total - caseNumbers.length),
  }
}

async function complete(system: string, user: string, maxCompletionTokens = 220) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('AI is not configured.')

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_completion_tokens: maxCompletionTokens,
      reasoning_effort: 'minimal',
    }),
  })

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string }
    choices?: { message?: { content?: unknown } }[]
  } | null

  if (!response.ok) {
    const message = payload?.error?.message?.trim()
    throw new Error(message || 'Unable to reach AI.')
  }

  const text = messageText(payload?.choices?.[0]?.message?.content)
  if (!text) throw new Error('AI did not return text.')
  return text
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
    const userId = Number(body.user_id)
    const sessionToken = body.session_token == null || body.session_token === ''
      ? null
      : String(body.session_token)
    const action = String(body.action ?? '')

    if (!Number.isFinite(userId)) throw new Error('Sign in to use AI.')

    const supabase = createAnonClient(req)
    const session = await supabase.rpc('validate_session', {
      p_user_id: userId,
      p_session_token: sessionToken,
    })
    if (session.error) throw new Error(rpcErrorMessage(session.error.message))

    const sessionData = parseJson(session.data) as { valid?: boolean } | null
    if (!sessionData?.valid) throw new Error('Sign in to use AI.')

    if (action === 'dashboard') {
      const question = String(body.question ?? '')
      const questionIndex = DASHBOARD_QUESTIONS.indexOf(question as (typeof DASHBOARD_QUESTIONS)[number])
      if (questionIndex < 0) throw new Error('Choose one of the suggested questions.')

      const period = String(body.period ?? '') === 'year' ? 'year' : 'month'
      const factsResult = await supabase.rpc('get_dashboard_ask_facts', { p_period: period })
      if (factsResult.error) throw new Error(rpcErrorMessage(factsResult.error.message))

      const facts = parseJson(factsResult.data) as Record<string, unknown> | null
      const factKey = FACT_KEYS[questionIndex]
      const fact = facts?.[factKey]
      if (fact == null) throw new Error('Unable to load dashboard facts.')

      const humanFacts = humanizeDashboardFacts(factKey, fact, period)
      const text = await complete(
        [
          'You write a formal barangay case dashboard report for Barangay Tanza 1 (Tanza Resolve).',
          'Use ONLY the provided facts object. Every count and barangay case number must come from those facts.',
          'Do not invent, estimate, or omit numbers that appear in the facts.',
          'Write for barangay staff in plain, professional English. Never mention JSON, databases, APIs, field names, snake_case keys, or programming terms.',
          'Say "barangay case number" or "case number", never case_no, case_nos, totalCount, or similar labels.',
          'When listing cases, write them as ordinary case numbers in a readable sentence or short list.',
          'If totalCount is 0, say clearly that there are none for that topic.',
          'If additionalCasesNotListed is greater than 0, say that more cases exist beyond those listed.',
          'Format as a brief formal report with these plain section headings on their own lines: Summary, Findings, Notes.',
          'Do not use markdown, asterisks, hash headings, or code formatting. Leave a blank line between sections.',
          'Do not give legal advice.',
        ].join(' '),
        `Question: ${question}\nReporting period: ${period === 'year' ? 'this year' : 'this month'}\nFacts: ${JSON.stringify(humanFacts)}`,
        700,
      )
      return jsonResponse({ text })
    }

    if (action === 'enhance') {
      const field = String(body.field ?? '') as EnhanceField
      const purpose = ENHANCE_FIELDS[field]
      if (!purpose) throw new Error('This field cannot be enhanced.')

      const draft = String(body.text ?? '').trim()
      if (!draft) throw new Error('Enter text before enhancing.')
      if (draft.length > MAX_DRAFT) {
        throw new Error('Shorten the text to 1500 characters before enhancing.')
      }

      const languageRules = [
        'Keep the exact same language mix as the draft.',
        'If the draft is English, return English.',
        'If the draft is Tagalog/Filipino, return Tagalog/Filipino.',
        'If the draft is Taglish (mixed Tagalog and English), return Taglish.',
        'Never translate the draft into another language.',
      ].join(' ')

      let voice: string
      if (field === 'settlement_terms') {
        voice =
          'Write the settlement terms directly. Do not narrate them as "the complainant requests."'
      } else if (field === 'relief') {
        voice = [
          'Write the relief prayer itself in the first person, as the complainant filling out "THEREFORE, I/WE pray…".',
          'Improve clarity and formality, but keep it as the requested relief/s, not a story of what happened.',
          'Use I or we only if the draft already does; otherwise keep prayer style such as "That the respondent…".',
          'Never say "the complainant" or describe them from the outside.',
        ].join(' ')
      } else {
        voice =
          'Write in the first person, as the complainant filling out the form. Use I or we, matching the draft. Never say "the complainant" or describe them from the outside.'
      }

      const text = await complete(
        [
          `Improve this draft into one clearer paragraph about ${purpose}.`,
          voice,
          languageRules,
          'Keep every name, date, place, and amount unchanged.',
          'Do not add facts.',
          'Do not copy the draft word for word.',
          'Return only the improved paragraph.',
        ].join(' '),
        draft,
      )
      return jsonResponse({ text })
    }

    throw new Error('Unknown request.')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to use AI.'
    return jsonResponse({ error: message }, 400)
  }
})
