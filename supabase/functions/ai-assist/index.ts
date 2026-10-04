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

async function complete(system: string, user: string) {
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
      max_completion_tokens: 220,
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

      const text = await complete(
        'You answer barangay case dashboard questions for Tanza 1. Use only the JSON facts. Do not invent case numbers or counts. If a list total is 0, say there are none. If case_nos is shorter than total, mention how many more are not listed. Keep the answer short and plain. Do not give legal advice.',
        `Question: ${question}\nFacts: ${JSON.stringify(fact)}`,
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

      const voice = field === 'settlement_terms'
        ? 'Write the settlement terms directly. Do not narrate them as "the complainant requests."'
        : 'Write in the first person, as the complainant filling out the form. Use I or we, matching the draft. Never say "the complainant" or describe them from the outside.'

      const text = await complete(
        `Improve this draft into one clearer paragraph about ${purpose}. ${voice} Use the same language as the draft, English or Filipino. Keep every name, date, place, and amount unchanged. Do not add facts. Do not copy the draft word for word. Return only the improved paragraph.`,
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
