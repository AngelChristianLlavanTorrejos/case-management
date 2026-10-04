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

    const parsed = data as { error?: string; skipped?: string } | null
    if (parsed?.error) throw new Error(parsed.error)
    if (parsed?.skipped === 'staff_created') return
    if (parsed?.skipped === 'no_mobile') {
      toast.error('SMS was not sent.', 'No linked party has a mobile number.')
    }
  } catch (error) {
    toast.error(
      'SMS could not be sent.',
      error instanceof Error ? error.message : undefined,
    )
  }
}
