import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import type { DashboardPeriod } from '@/lib/dashboard-api'

export type EnhanceField =
  | 'manner'
  | 'relief'
  | 'fraud'
  | 'violence'
  | 'intimidation'
  | 'settlement_terms'

async function invokeAi(body: Record<string, unknown>) {
  const session = useAuthStore.getState().session
  if (!session?.id) throw new Error('Sign in to use AI.')

  const { data, error } = await supabase.functions.invoke('ai-assist', {
    body: {
      ...body,
      user_id: session.id,
      session_token: session.sessionToken ?? null,
    },
  })

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

  const parsed = data as { error?: string; text?: string } | null
  if (parsed?.error) throw new Error(parsed.error)
  const text = parsed?.text?.trim()
  if (!text) throw new Error('AI did not return text.')
  return text
}

export function askDashboard(question: string, period: DashboardPeriod) {
  return invokeAi({ action: 'dashboard', question, period })
}

export function enhanceText(field: EnhanceField, text: string) {
  return invokeAi({ action: 'enhance', field, text })
}
