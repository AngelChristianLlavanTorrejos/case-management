import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

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
import {
  createNoticeOfExecution,
  listNoticeOfExecutionCases,
  type ExecutionCaseOption,
} from '@/lib/notice-of-execution-api'

export function AddNoticeOfExecutionDialog({
  open,
  actorUserId,
  onClose,
  onCreated,
}: {
  open: boolean
  actorUserId: number | undefined
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const [noticeMotionId, setNoticeMotionId] = useState('')
  const [partyObliged, setPartyObliged] = useState<'complainants' | 'respondents' | ''>('')
  const [personalPropertyOf, setPersonalPropertyOf] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const casesQuery = useQuery({
    queryKey: ['notice-of-execution-cases'],
    queryFn: listNoticeOfExecutionCases,
    enabled: open,
  })

  const cases = casesQuery.data ?? []
  const selected = cases.find((item) => String(item.id) === noticeMotionId) ?? null

  useEffect(() => {
    if (casesQuery.isError) {
      setError(
        casesQuery.error instanceof Error
          ? casesQuery.error.message
          : 'Unable to load barangay cases.',
      )
    }
  }, [casesQuery.error, casesQuery.isError])

  function reset() {
    setNoticeMotionId('')
    setPartyObliged('')
    setPersonalPropertyOf('')
    setAmount('')
    setError(null)
    setSaving(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset()
      onClose()
    }
  }

  async function handleSubmit() {
    if (!actorUserId) {
      setError('You must be signed in.')
      return
    }
    if (!noticeMotionId) {
      setError('Barangay case is required.')
      return
    }
    if (!partyObliged) {
      setError('Party obliged is required.')
      return
    }
    if (!personalPropertyOf.trim()) {
      setError('Personal property of is required.')
      return
    }
    if (!amount.trim()) {
      setError('The sum of is required.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await createNoticeOfExecution(
        Number(noticeMotionId),
        actorUserId,
        partyObliged,
        personalPropertyOf.trim(),
        amount.trim(),
      )
      await onCreated()
      toast.success('Notice of execution recorded.')
      reset()
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this notice.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add notice of execution</DialogTitle>
          <DialogDescription>
            Choose a barangay case whose motion hearing is past five days and is not settled.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field
            label="Barangay case"
            htmlFor="execution-case"
            required
            error={!noticeMotionId && error ? error : undefined}
          >
            <Select
              value={noticeMotionId || undefined}
              onValueChange={(value) => {
                setNoticeMotionId(value)
                if (error) setError(null)
              }}
            >
              <SelectTrigger
                id="execution-case"
                className="h-10 w-full bg-white"
                aria-invalid={!noticeMotionId && Boolean(error)}
              >
                <SelectValue
                  placeholder={casesQuery.isLoading ? 'Loading cases…' : 'Select barangay case'}
                />
              </SelectTrigger>
              <SelectContent position="popper" align="start" className="w-(--radix-select-trigger-width)">
                {cases.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {caseLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {selected ? (
            <div className="grid gap-2 text-sm text-[#666666]">
              <p>
                <span className="font-medium text-[#171717]">Complainants: </span>
                {selected.complainants || '—'}
              </p>
              <p>
                <span className="font-medium text-[#171717]">Respondents: </span>
                {selected.respondents || '—'}
              </p>
              <div>
                <p className="font-medium text-[#171717]">Settlement terms</p>
                <p className="mt-0.5 whitespace-pre-wrap">{selected.terms || '—'}</p>
              </div>
            </div>
          ) : null}
          <Field
            label="Party obliged"
            htmlFor="execution-party"
            required
            error={error && noticeMotionId && !partyObliged ? error : undefined}
          >
            <Select
              value={partyObliged || undefined}
              onValueChange={(value) => {
                setPartyObliged(value as 'complainants' | 'respondents')
                if (error) setError(null)
              }}
            >
              <SelectTrigger id="execution-party" className="h-10 w-full bg-white">
                <SelectValue placeholder="Select party" />
              </SelectTrigger>
              <SelectContent position="popper" align="start" className="w-(--radix-select-trigger-width)">
                <SelectItem value="complainants">Complainants</SelectItem>
                <SelectItem value="respondents">Respondents</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Personal property of"
            htmlFor="execution-property"
            required
            error={error && partyObliged && !personalPropertyOf.trim() ? error : undefined}
          >
            <Input
              id="execution-property"
              className="h-10 bg-white"
              value={personalPropertyOf}
              onChange={(event) => {
                setPersonalPropertyOf(event.target.value)
                if (error) setError(null)
              }}
            />
          </Field>
          <Field
            label="The sum of"
            htmlFor="execution-amount"
            required
            error={error && personalPropertyOf.trim() && !amount.trim() ? error : undefined}
          >
            <Input
              id="execution-amount"
              className="h-10 bg-white"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value)
                if (error) setError(null)
              }}
            />
          </Field>
          {casesQuery.isSuccess && cases.length === 0 ? (
            <p className="text-sm text-[#666666]">
              No eligible barangay cases. Cases appear here five days after the motion hearing if they
              are not settled.
            </p>
          ) : null}
          {error && noticeMotionId && partyObliged && personalPropertyOf.trim() && amount.trim() ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="cursor-pointer" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function caseLabel(item: ExecutionCaseOption) {
  return item.barangay_case_no || `Case ${item.id}`
}
