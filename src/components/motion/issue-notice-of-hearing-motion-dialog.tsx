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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast.tsx'
import { fromDatetimeLocalValue } from '@/lib/hearing-summon-api'
import { issueNoticeOfHearingMotion } from '@/lib/notice-of-hearing-motion-api'

export function IssueNoticeOfHearingMotionDialog({
  motionId,
  actorUserId,
  onClose,
  onIssued,
}: {
  motionId: number | null
  actorUserId: number | undefined
  onClose: () => void
  onIssued: () => Promise<void>
}) {
  const [appearAt, setAppearAt] = useState('')
  const [filedBy, setFiledBy] = useState<'complainants' | 'respondents' | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function reset() {
    setAppearAt('')
    setFiledBy('')
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
    if (!motionId) return
    if (!actorUserId) {
      setError('You must be signed in.')
      return
    }
    if (!appearAt) {
      setError('Appear on is required.')
      return
    }
    if (!filedBy) {
      setError('Filed by is required.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await issueNoticeOfHearingMotion(
        motionId,
        actorUserId,
        fromDatetimeLocalValue(appearAt),
        filedBy,
      )
      await onIssued()
      toast.success('Notice of hearing (RE: Motion for Execution) issued.')
      reset()
      onClose()
    } catch (issueError) {
      setError(
        issueError instanceof Error
          ? issueError.message
          : 'Unable to issue notice of hearing.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={motionId !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Notice of Hearing (RE: Motion for Execution)</DialogTitle>
          <DialogDescription>
            Set when the parties should appear and who filed the motion.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field
            label="Appear on"
            htmlFor="motion-notice-appear-at"
            required
            error={error && !appearAt ? error : undefined}
          >
            <Input
              id="motion-notice-appear-at"
              type="datetime-local"
              className="h-10 bg-white"
              value={appearAt}
              onChange={(event) => {
                setAppearAt(event.target.value)
                if (error) setError(null)
              }}
            />
          </Field>
          <Field
            label="Filed by"
            htmlFor="motion-notice-filed-by"
            required
            error={error && appearAt && !filedBy ? error : undefined}
          >
            <Select
              value={filedBy || undefined}
              onValueChange={(value) => {
                setFiledBy(value as 'complainants' | 'respondents')
                if (error) setError(null)
              }}
            >
              <SelectTrigger
                id="motion-notice-filed-by"
                className="h-10 w-full bg-white"
                aria-invalid={Boolean(error && appearAt && !filedBy)}
              >
                <SelectValue placeholder="Select party" />
              </SelectTrigger>
              <SelectContent position="popper" align="start" className="w-(--radix-select-trigger-width)">
                <SelectItem value="complainants">Complainants</SelectItem>
                <SelectItem value="respondents">Respondents</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {error && appearAt && filedBy ? <p className="text-sm text-destructive">{error}</p> : null}
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
