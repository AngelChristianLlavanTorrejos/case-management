import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'

import { EnhanceButton } from '@/components/ai/enhance-button'
import { Field } from '@/components/auth/field'
import { IssueNoticeSummonDialog } from '@/components/complaints/issue-notice-summon-dialog'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast.tsx'
import { createComplaint, getComplaint, markComplaintReceivedAndFiled, updateComplaint } from '@/lib/complaints-api'
import { listLookupOptions } from '@/lib/lookup-api'
import { isUserRole } from '@/lib/roles'
import { complaintFormSchema, type ComplaintFormValues } from '@/schemas/complaint'
import { useAuthStore } from '@/stores/auth-store'

type RecordMode = 'add' | 'edit' | 'view'

function NameList({
  label,
  htmlFor,
  names,
  error,
  readOnly,
  onChange,
}: {
  label: string
  htmlFor: string
  names: string[]
  error?: string
  readOnly?: boolean
  onChange: (names: string[]) => void
}) {
  const confirm = useConfirm()
  const [draft, setDraft] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  function resetDraft() {
    setDraft('')
    setEditingIndex(null)
    setLocalError(null)
  }

  function handleAddOrSave() {
    const name = draft.trim()
    if (!name) {
      setLocalError('Name is required')
      return
    }

    if (editingIndex === null) {
      onChange([...names, name])
    } else {
      onChange(names.map((item, index) => (index === editingIndex ? name : item)))
    }
    resetDraft()
  }

  function handleEdit(index: number) {
    setDraft(names[index] ?? '')
    setEditingIndex(index)
    setLocalError(null)
  }

  async function handleDelete(index: number) {
    const confirmed = await confirm({
      title: 'Remove this name?',
      description: `Remove “${names[index]}” from the list.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!confirmed) return
    onChange(names.filter((_, itemIndex) => itemIndex !== index))
    if (editingIndex === index) resetDraft()
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1)
  }

  return (
    <Field label={label} htmlFor={htmlFor} required error={error ?? localError ?? undefined}>
      {readOnly ? null : (
        <div className="flex gap-2">
          <Input
            id={htmlFor}
            className="h-10 bg-white"
            value={draft}
            placeholder="e.g. Juan Dela Cruz"
            onChange={(event) => {
              setDraft(event.target.value)
              if (localError) setLocalError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleAddOrSave()
              }
            }}
          />
          <Button type="button" variant="outline" className="h-10 shrink-0 cursor-pointer" onClick={handleAddOrSave}>
            {editingIndex === null ? (
              <>
                <Plus className="size-4" />
                Add
              </>
            ) : (
              'Save'
            )}
          </Button>
          {editingIndex !== null ? (
            <Button type="button" variant="ghost" className="h-10 shrink-0 cursor-pointer" onClick={resetDraft}>
              Cancel
            </Button>
          ) : null}
        </div>
      )}

      {names.length > 0 ? (
        <ul className="mt-2 divide-y divide-[#E5E5E6] rounded-lg border border-[#E5E5E6] bg-white">
          {names.map((name, index) => (
            <li key={`${name}-${index}`} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 text-sm text-[#171717]">{name}</span>
              {readOnly ? null : (
                <>
                  <button
                    type="button"
                    className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#666666] hover:bg-[#F5F5F5] hover:text-[#171717]"
                    aria-label={`Edit ${name}`}
                    onClick={() => handleEdit(index)}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#666666] hover:bg-[#F5F5F5] hover:text-destructive"
                    aria-label={`Delete ${name}`}
                    onClick={() => void handleDelete(index)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : readOnly ? (
        <p className="mt-2 text-sm text-[#666666]">None</p>
      ) : null}
    </Field>
  )
}

const PAGE_COPY: Record<RecordMode, { title: string; description: string }> = {
  add: {
    title: 'Add',
    description: 'Enter the parties and the details of the complaint.',
  },
  edit: {
    title: 'Edit',
    description: 'Update the parties and the details of the complaint.',
  },
  view: {
    title: 'View',
    description: 'Review the parties and the details of the complaint.',
  },
}

export function ComplainantRecordPage({ mode }: { mode: RecordMode }) {
  const confirm = useConfirm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const isUser = isUserRole(useAuthStore((state) => state.session?.roleName))
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [issueOpen, setIssueOpen] = useState(false)
  const recordId = mode === 'add' ? null : Number(id)

  const complaintTypes = useQuery({
    queryKey: ['lookups', 'complaint_type', 'options'],
    queryFn: () => listLookupOptions('complaint_type'),
  })

  const recordQuery = useQuery({
    queryKey: ['complaint', recordId, actorUserId],
    queryFn: () => getComplaint(recordId as number, actorUserId as number),
    enabled: recordId !== null && Number.isFinite(recordId) && Boolean(actorUserId),
  })

  const typeOptions = complaintTypes.data ?? []
  const record = recordQuery.data
  const filed = Boolean(record?.is_received_and_filed)
  const readOnly = mode === 'view' || (mode === 'edit' && filed)
  const copy = mode === 'edit' && filed ? PAGE_COPY.view : PAGE_COPY[mode]

  const form = useForm<ComplaintFormValues>({
    resolver: zodResolver(complaintFormSchema),
    defaultValues: {
      complaint_type_id: '',
      complainants: [],
      respondents: [],
      manner: '',
      relief: '',
    },
  })

  useEffect(() => {
    if (!record) return
    form.reset({
      complaint_type_id: String(record.complaint_type_id ?? ''),
      complainants: record.complainants,
      respondents: record.respondents,
      manner: record.manner,
      relief: record.relief,
    })
  }, [form, record])

  const complainants = form.watch('complainants')
  const respondents = form.watch('respondents')
  const complaintTypeId = form.watch('complaint_type_id')
  const manner = form.watch('manner')
  const relief = form.watch('relief')

  async function onSubmit(values: ComplaintFormValues) {
    if (readOnly) return
    if (!actorUserId) throw new Error('You must be signed in.')

    const confirmed = await confirm({
      title: mode === 'edit' ? 'Save complaint changes?' : 'Submit complainant’s form?',
      description:
        mode === 'edit'
          ? 'This will update the complaint with the listed complainant/s and respondent/s.'
          : 'This will save the complaint with the listed complainant/s and respondent/s.',
      confirmLabel: mode === 'edit' ? 'Save' : 'Submit',
    })
    if (!confirmed) return

    setSubmitError(null)

    const payload = {
      complaint_type_id: Number(values.complaint_type_id),
      complainants: values.complainants,
      respondents: values.respondents,
      manner: values.manner,
      relief: values.relief,
    }

    try {
      if (mode === 'edit' && recordId !== null) {
        await updateComplaint(recordId, actorUserId, payload)
        toast.success('Complaint updated.')
      } else {
        await createComplaint(actorUserId, payload)
        toast.success('Complainant’s form submitted.')
      }
      await queryClient.invalidateQueries({ queryKey: ['complaints'] })
      await queryClient.invalidateQueries({ queryKey: ['complaint'] })
      navigate('/complainants-form')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save the form.'
      setSubmitError(message)
      toast.error('Unable to save the form.', message)
    }
  }

  function goBack() {
    navigate('/complainants-form')
  }

  async function handleReceivedAndFiled() {
    if (recordId === null) return
    if (!actorUserId) throw new Error('You must be signed in.')

    const confirmed = await confirm({
      title: 'Mark as received and filed?',
      description: 'This will set Received and filed to Yes.',
      confirmLabel: 'Received and filed',
    })
    if (!confirmed) return

    try {
      await markComplaintReceivedAndFiled(recordId, actorUserId)
      await queryClient.invalidateQueries({ queryKey: ['complaints'] })
      await queryClient.invalidateQueries({ queryKey: ['complaint'] })
      toast.success('Complaint marked as received and filed.')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to mark this complaint as received and filed.'
      toast.error('Unable to mark this complaint as received and filed.', message)
    }
  }

  if (mode !== 'add' && (!recordId || !Number.isFinite(recordId))) {
    return (
      <div>
        <Button type="button" variant="outline" className="cursor-pointer" onClick={goBack}>
          Back
        </Button>
        <p className="mt-4 text-sm text-destructive">Complaint not found.</p>
      </div>
    )
  }

  if (mode !== 'add' && recordQuery.isError) {
    return (
      <div>
        <Button type="button" variant="outline" className="cursor-pointer" onClick={goBack}>
          Back
        </Button>
        <p className="mt-4 text-sm text-destructive">
          {recordQuery.error instanceof Error ? recordQuery.error.message : 'Unable to load this complaint.'}
        </p>
      </div>
    )
  }

  if (mode !== 'add' && (recordQuery.isLoading || complaintTypes.isLoading || !record)) {
    return (
      <div>
        <Button type="button" variant="outline" className="cursor-pointer" onClick={goBack}>
          Back
        </Button>
        <p className="mt-4 text-sm text-[#666666]">Loading complaint...</p>
      </div>
    )
  }

  const selectedTypeId = complaintTypeId || String(record?.complaint_type_id ?? '')
  const options =
    record && selectedTypeId && !typeOptions.some((option) => String(option.id) === selectedTypeId)
      ? [{ id: record.complaint_type_id, name: record.complaint_type }, ...typeOptions]
      : typeOptions

  return (
    <div>
      <PageHeader title={copy.title} description={copy.description} />

      <form className="mt-5 grid max-w-3xl gap-6" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {mode !== 'add' ? (
          <Field label="Barangay case no." htmlFor="barangay_case_no">
            <Input
              id="barangay_case_no"
              className="h-10 bg-white"
              value={record?.barangay_case_no || '—'}
              disabled
              readOnly
            />
          </Field>
        ) : null}

        <Field
          label="Complaint type"
          htmlFor="complaint_type_id"
          required
          error={
            form.formState.errors.complaint_type_id?.message ??
            (complaintTypes.error instanceof Error ? complaintTypes.error.message : undefined)
          }
        >
          <Select
            key={selectedTypeId || 'complaint-type'}
            value={selectedTypeId || undefined}
            disabled={readOnly}
            onValueChange={(value) => {
              form.setValue('complaint_type_id', value, { shouldValidate: form.formState.isSubmitted })
            }}
          >
            <SelectTrigger
              id="complaint_type_id"
              className={readOnly ? 'h-10 w-full bg-white' : 'h-10 w-full cursor-pointer bg-white'}
              aria-invalid={Boolean(form.formState.errors.complaint_type_id)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start" className="w-(--radix-select-trigger-width)">
              {options.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <NameList
          label="Complainant/s"
          htmlFor="complainants"
          names={complainants}
          readOnly={readOnly}
          error={form.formState.errors.complainants?.message}
          onChange={(names) => {
            form.setValue('complainants', names, { shouldValidate: form.formState.isSubmitted })
          }}
        />

        <NameList
          label="Respondent/s"
          htmlFor="respondents"
          names={respondents}
          readOnly={readOnly}
          error={form.formState.errors.respondents?.message}
          onChange={(names) => {
            form.setValue('respondents', names, { shouldValidate: form.formState.isSubmitted })
          }}
        />

        <h2 className="text-sm font-semibold tracking-wide text-[#171717]">COMPLAINT</h2>

        <Field
          label="I/WE hereby complain against above named respondent/s for violating my/our rights and interests in the following manner:"
          htmlFor="manner"
          required
          error={form.formState.errors.manner?.message}
          action={
            readOnly ? undefined : (
              <EnhanceButton
                field="manner"
                text={manner}
                onEnhanced={(value) =>
                  form.setValue('manner', value, {
                    shouldDirty: true,
                    shouldValidate: form.formState.isSubmitted,
                  })
                }
              />
            )
          }
        >
          <Textarea
            id="manner"
            className="bg-white"
            disabled={readOnly}
            placeholder="e.g. On 15 September 2026 at Blk 12 Lot 5, M. Naval St., Tanza 1, the respondent publicly insulted me and refused to return money I lent, causing me shame and loss."
            aria-invalid={Boolean(form.formState.errors.manner)}
            {...form.register('manner')}
          />
        </Field>

        <Field
          label="THEREFORE, I/WE pray that the following relief/s be granted to me/us in accordance with law and/or equity:"
          htmlFor="relief"
          required
          error={form.formState.errors.relief?.message}
          action={
            readOnly ? undefined : (
              <EnhanceButton
                field="relief"
                text={relief}
                onEnhanced={(value) =>
                  form.setValue('relief', value, {
                    shouldDirty: true,
                    shouldValidate: form.formState.isSubmitted,
                  })
                }
              />
            )
          }
        >
          <Textarea
            id="relief"
            className="bg-white"
            disabled={readOnly}
            placeholder="e.g. That the respondent return the money and issue a written apology."
            aria-invalid={Boolean(form.formState.errors.relief)}
            {...form.register('relief')}
          />
        </Field>

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={goBack}>
            Back
          </Button>
          {mode !== 'add' && record && !isUser && !record.is_received_and_filed ? (
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => void handleReceivedAndFiled()}>
              Received and filed
            </Button>
          ) : null}
          {mode !== 'add' && record && !isUser && record.is_received_and_filed && !record.is_notice_and_summon_issued ? (
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setIssueOpen(true)}
            >
              Notice of Hearing and Summon
            </Button>
          ) : null}
          {readOnly ? null : (
            <Button type="submit" className="cursor-pointer" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving…' : mode === 'edit' ? 'Save' : 'Submit'}
            </Button>
          )}
        </div>
      </form>
      <IssueNoticeSummonDialog
        complaintId={issueOpen ? recordId : null}
        actorUserId={actorUserId}
        onClose={() => setIssueOpen(false)}
        onIssued={async () => {
          await queryClient.invalidateQueries({ queryKey: ['complaints'] })
          await queryClient.invalidateQueries({ queryKey: ['complaint'] })
          await queryClient.invalidateQueries({ queryKey: ['notices-of-hearing'] })
          await queryClient.invalidateQueries({ queryKey: ['summons'] })
        }}
      />
    </div>
  )
}
