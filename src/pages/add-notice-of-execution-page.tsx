import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Field } from '@/components/auth/field'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast.tsx'
import {
  createNoticeOfExecution,
  listNoticeOfExecutionCases,
  type ExecutionCaseOption,
} from '@/lib/notice-of-execution-api'
import { useAuthStore } from '@/stores/auth-store'

export function AddNoticeOfExecutionPage() {
  const navigate = useNavigate()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const [noticeMotionId, setNoticeMotionId] = useState('')
  const [partyObliged, setPartyObliged] = useState<'complainants' | 'respondents' | ''>('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const casesQuery = useQuery({
    queryKey: ['notice-of-execution-cases'],
    queryFn: listNoticeOfExecutionCases,
  })

  const cases = casesQuery.data ?? []
  const selected = cases.find((item) => String(item.id) === noticeMotionId) ?? null
  const personalPropertyOf = obligedNames(selected, partyObliged)

  useEffect(() => {
    if (casesQuery.isError) {
      setError(
        casesQuery.error instanceof Error
          ? casesQuery.error.message
          : 'Unable to load barangay cases.',
      )
    }
  }, [casesQuery.error, casesQuery.isError])

  function goBack() {
    navigate('/notice-of-execution')
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
      setError('The obliged party has no names on this case.')
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
      toast.success('Notice of execution recorded.')
      goBack()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this notice.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Add"
        description="Choose a barangay case whose motion hearing is past five days and is not settled."
      />

      <form
        className="mt-5 grid max-w-3xl gap-6"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
        noValidate
      >
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
        {casesQuery.isSuccess && cases.length === 0 ? (
          <p className="text-sm text-[#666666]">
            No eligible barangay cases. Cases appear here five days after the motion hearing if they
            are not settled.
          </p>
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
        <Field label="The sum of" htmlFor="execution-amount" optional>
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
        {error && noticeMotionId && partyObliged ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={goBack}>
            Back
          </Button>
          <Button type="submit" className="cursor-pointer" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function caseLabel(item: ExecutionCaseOption) {
  return item.barangay_case_no || `Case ${item.id}`
}

function obligedNames(
  selected: ExecutionCaseOption | null,
  partyObliged: 'complainants' | 'respondents' | '',
) {
  if (!selected || !partyObliged) return ''
  return partyObliged === 'respondents' ? selected.respondents : selected.complainants
}
