import { useState } from 'react'

import { Field } from '@/components/auth/field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast.tsx'
import { fromDatetimeLocalValue, issueNoticeAndSummon } from '@/lib/hearing-summon-api'

export function IssueNoticeSummonDialog({
  complaintId,
  actorUserId,
  onClose,
  onIssued,
}: {
  complaintId: number | null
  actorUserId: number | undefined
  onClose: () => void
  onIssued: () => Promise<void>
}) {
  const [appearAt, setAppearAt] = useState('')
  const [officer, setOfficer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function reset() {
    setAppearAt('')
    setOfficer('')
    setError(null)
    setSaving(false)
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset()
      onClose()
    }
  }

  async function handleSubmit() {
    if (!complaintId) return
    if (!actorUserId) {
      setError('You must be signed in.')
      return
    }
    if (!appearAt) {
      setError('Appear on is required.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await issueNoticeAndSummon(complaintId, actorUserId, fromDatetimeLocalValue(appearAt), officer)
      await onIssued()
      toast.success('Notice of hearing and summon issued.')
      reset()
      onClose()
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : 'Unable to issue notice and summon.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={complaintId !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notice of Hearing and Summon</DialogTitle>
          <DialogDescription>Set when the parties should appear. Serving officer is optional.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Appear on" htmlFor="issue-appear-at" required error={error && !appearAt ? error : undefined}>
            <Input
              id="issue-appear-at"
              type="datetime-local"
              className="h-10 bg-white"
              value={appearAt}
              onChange={(event) => {
                setAppearAt(event.target.value)
                if (error) setError(null)
              }}
            />
          </Field>
          <Field label="Serving Officer" htmlFor="issue-officer" optional>
            <Input
              id="issue-officer"
              className="h-10 bg-white"
              value={officer}
              placeholder="e.g. PO Juan Dela Cruz"
              onChange={(event) => setOfficer(event.target.value)}
            />
          </Field>
          {error && appearAt ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="cursor-pointer" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Issuing…' : 'Issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
