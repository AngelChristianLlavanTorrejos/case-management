import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Field } from '@/components/auth/field'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast.tsx'
import {
  createRepudiation,
  listRepudiationCases,
  type RepudiationCaseOption,
} from '@/lib/repudiation-api'
import { useAuthStore } from '@/stores/auth-store'

export function AddRepudiationPage() {
  const navigate = useNavigate()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const [complaintId, setComplaintId] = useState('')
  const [fraud, setFraud] = useState(false)
  const [fraudDetails, setFraudDetails] = useState('')
  const [violence, setViolence] = useState(false)
  const [violenceDetails, setViolenceDetails] = useState('')
  const [intimidation, setIntimidation] = useState(false)
  const [intimidationDetails, setIntimidationDetails] = useState('')
  const [swornOn, setSwornOn] = useState('')
  const [receivedOn, setReceivedOn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const casesQuery = useQuery({
    queryKey: ['repudiation-cases'],
    queryFn: listRepudiationCases,
  })

  const cases = casesQuery.data ?? []
  const selected = cases.find((item) => String(item.id) === complaintId) ?? null

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
    navigate('/repudiation')
  }

  async function handleSubmit() {
    if (!actorUserId) {
      setError('You must be signed in.')
      return
    }
    if (!complaintId) {
      setError('Barangay case is required.')
      return
    }
    if (!fraud && !violence && !intimidation) {
      setError('Select at least one ground for repudiation.')
      return
    }
    if (fraud && !fraudDetails.trim()) {
      setError('Fraud details are required.')
      return
    }
    if (violence && !violenceDetails.trim()) {
      setError('Violence details are required.')
      return
    }
    if (intimidation && !intimidationDetails.trim()) {
      setError('Intimidation details are required.')
      return
    }
    if (!swornOn) {
      setError('Sworn date is required.')
      return
    }
    if (!receivedOn) {
      setError('Received and filed date is required.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await createRepudiation(actorUserId, {
        complaintId: Number(complaintId),
        fraud,
        fraudDetails,
        violence,
        violenceDetails,
        intimidation,
        intimidationDetails,
        swornOn,
        receivedAndFiledOn: receivedOn,
      })
      toast.success('Repudiation recorded.')
      goBack()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this repudiation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Add"
        description="Choose a settlement created within the last ten days, then state the ground for repudiation."
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
          htmlFor="repudiation-case"
          required
          error={!complaintId && error ? error : undefined}
        >
          <Select
            value={complaintId || undefined}
            onValueChange={(value) => {
              setComplaintId(value)
              if (error) setError(null)
            }}
          >
            <SelectTrigger id="repudiation-case" className="h-10 w-full bg-white" aria-invalid={!complaintId && Boolean(error)}>
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
          <div className="grid gap-1 text-sm text-[#666666]">
            <p>
              <span className="font-medium text-[#171717]">Complainants: </span>
              {selected.complainants || '—'}
            </p>
            <p>
              <span className="font-medium text-[#171717]">Respondents: </span>
              {selected.respondents || '—'}
            </p>
          </div>
        ) : null}
        {casesQuery.isSuccess && cases.length === 0 ? (
          <p className="text-sm text-[#666666]">
            No eligible barangay cases. Settlements older than ten days cannot be repudiated here.
          </p>
        ) : null}

        <div className="grid gap-3">
          <p className="text-center text-sm font-semibold tracking-wide text-[#171717]">REPUDIATION</p>
          <p className="text-sm text-[#171717]">
            I/WE hereby repudiate the settlement/agreement for arbitration on the ground that my/our consent
            was vitiated by:
          </p>
          <p className="text-sm text-[#666666]">(Check out whichever is applicable)</p>
          <GroundField
            id="repudiation-fraud"
            label="Fraud. (State details)"
            checked={fraud}
            details={fraudDetails}
            onCheckedChange={setFraud}
            onDetailsChange={setFraudDetails}
            onClearError={() => {
              if (error) setError(null)
            }}
          />
          <GroundField
            id="repudiation-violence"
            label="Violence. (State details)"
            checked={violence}
            details={violenceDetails}
            onCheckedChange={setViolence}
            onDetailsChange={setViolenceDetails}
            onClearError={() => {
              if (error) setError(null)
            }}
          />
          <GroundField
            id="repudiation-intimidation"
            label="Intimidation. (State details)"
            checked={intimidation}
            details={intimidationDetails}
            onCheckedChange={setIntimidation}
            onDetailsChange={setIntimidationDetails}
            onClearError={() => {
              if (error) setError(null)
            }}
          />
        </div>

        <Field label="Sworn date" htmlFor="repudiation-sworn" required>
          <Input
            id="repudiation-sworn"
            type="date"
            className="h-10 bg-white"
            value={swornOn}
            onChange={(event) => {
              setSwornOn(event.target.value)
              if (error) setError(null)
            }}
          />
        </Field>
        <Field label="Received and filed date" htmlFor="repudiation-received" required>
          <Input
            id="repudiation-received"
            type="date"
            className="h-10 bg-white"
            value={receivedOn}
            onChange={(event) => {
              setReceivedOn(event.target.value)
              if (error) setError(null)
            }}
          />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

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

function EnhanceButton({ hasContent }: { hasContent: boolean }) {
  return (
    <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={!hasContent}>
      <Sparkles />
      AI Enhance
    </Button>
  )
}

function GroundField({
  id,
  label,
  checked,
  details,
  onCheckedChange,
  onDetailsChange,
  onClearError,
}: {
  id: string
  label: string
  checked: boolean
  details: string
  onCheckedChange: (checked: boolean) => void
  onDetailsChange: (value: string) => void
  onClearError: () => void
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="flex min-w-0 flex-1 items-start gap-2 text-sm text-[#171717]">
          <Checkbox
            id={id}
            checked={checked}
            className="mt-0.5"
            onCheckedChange={(value) => {
              onCheckedChange(value === true)
              onClearError()
            }}
          />
          <span>{label}</span>
        </label>
        <EnhanceButton hasContent={checked && details.trim().length > 0} />
      </div>
      <Textarea
        id={`${id}-details`}
        className="bg-white"
        value={details}
        disabled={!checked}
        placeholder={checked ? 'State details' : undefined}
        onChange={(event) => {
          onDetailsChange(event.target.value)
          onClearError()
        }}
      />
    </div>
  )
}

function caseLabel(item: RepudiationCaseOption) {
  return item.barangay_case_no || `Case ${item.id}`
}
