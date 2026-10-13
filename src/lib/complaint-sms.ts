import { toast } from '@/hooks/use-toast.tsx'
import { supabase } from '@/lib/supabase'

export type ComplaintSmsKind =
  | 'received_and_filed'
  | 'notice_of_hearing'
  | 'repudiation_filed'
  | 'repudiation_received_and_filed'
  | 'amicable_settlement_recorded'
  | 'settlement_settled'
  | 'motion_for_execution_created'
  | 'notice_of_hearing_motion'
  | 'notice_of_execution'
  | 'certificate_to_file_action'

type NotifyResult = {
  error?: string
  skipped?: string
  partial?: boolean
  sent?: number
  failed?: number
  sent_roles?: string[]
  distinct_numbers?: number
  same_mobile?: boolean
  respondent_linked?: boolean
  respondent_has_mobile?: boolean
}

function invokeErrorMessage(error: { message: string; context?: Response }) {
  const fallback = error.message
  // supabase-js often surfaces only "non-2xx"; prefer the function body when present.
  return (async () => {
    try {
      const response = error.context
      if (!response) return fallback
      const parsed = (await response.json()) as { error?: string; message?: string }
      if (parsed?.error) return parsed.error
      if (parsed?.message) return parsed.message
    } catch {
      // keep the original message
    }
    return fallback.replace(/^Edge Function returned a non-2xx status code$/i, 'SMS provider error.')
  })()
}

export async function notifyComplaintSms(
  kind: ComplaintSmsKind,
  complaintId: number,
  extras?: { appearAt?: string | null },
) {
  try {
    const { data, error } = await supabase.functions.invoke('complaint-notify', {
      body: {
        kind,
        complaint_id: complaintId,
        appear_at: extras?.appearAt ?? null,
      },
    })

    if (error) {
      throw new Error(await invokeErrorMessage(error as { message: string; context?: Response }))
    }

    const parsed = data as NotifyResult | null
    if (!parsed) return

    if (parsed.skipped === 'staff_created') {
      toast.success('SMS skipped.', 'Complaint was filed by staff.')
      return
    }
    if (parsed.skipped === 'no_mobile') {
      toast.error('SMS was not sent.', 'No linked party has a valid mobile number.')
      return
    }
    if (parsed.partial) {
      toast.error(
        'SMS partly sent.',
        `Sent to ${parsed.sent ?? 0} number(s); ${parsed.failed ?? 0} failed${
          parsed.error ? `: ${parsed.error}` : '.'
        }`,
      )
      return
    }
    if (parsed.error && !parsed.sent) throw new Error(parsed.error)

    if (parsed.same_mobile) {
      toast.success(
        'SMS sent.',
        'Complainant and respondent share the same mobile number.',
      )
      return
    }
    if (
      typeof parsed.respondent_linked === 'boolean' &&
      parsed.respondent_linked &&
      !parsed.respondent_has_mobile &&
      (parsed.sent ?? 0) > 0
    ) {
      toast.error(
        'SMS sent to complainant only.',
        'Respondent is linked but has no valid mobile number.',
      )
    }
  } catch (error) {
    toast.error(
      'SMS could not be sent.',
      error instanceof Error ? error.message : undefined,
    )
  }
}
