import { toast } from '@/hooks/use-toast.tsx'
import { supabase } from '@/lib/supabase'

export async function notifyComplaintSms(
  kind: 'received_and_filed' | 'notice_of_hearing',
  complaintId: number,
) {
  try {
    const { data, error } = await supabase.functions.invoke('complaint-notify', {
      body: { kind, complaint_id: complaintId },
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
    if (parsed?.skipped === 'no_mobile') {
      toast.error('SMS was not sent.', 'The filer has no mobile number.')
    }
  } catch (error) {
    toast.error(
      'SMS could not be sent.',
      error instanceof Error ? error.message : undefined,
    )
  }
}
