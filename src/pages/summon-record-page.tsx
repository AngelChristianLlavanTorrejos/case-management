import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, File, FileText, FileType, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Field } from '@/components/auth/field'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast.tsx'
import { formatComplaintWhen } from '@/lib/complaints-api'
import {
  addSummonAttachment,
  deleteSummonAttachment,
  fromDatetimeLocalValue,
  getSummon,
  getSummonAttachmentUrl,
  toDatetimeLocalValue,
  updateSummon,
  uploadSummonAttachment,
  type SummonAttachment,
} from '@/lib/hearing-summon-api'
import { useAuthStore } from '@/stores/auth-store'

type RecordMode = 'edit' | 'view'

const PAGE_COPY: Record<RecordMode, { title: string; description: string }> = {
  edit: {
    title: 'Edit',
    description: 'Update service details, recipients, or serving officer.',
  },
  view: {
    title: 'View',
    description: 'Review the summon issued to the respondent.',
  },
}

export function SummonRecordPage({ mode }: { mode: RecordMode }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const summonId = Number(id)
  const readOnly = mode === 'view'
  const copy = PAGE_COPY[mode]

  const query = useQuery({
    queryKey: ['summon', summonId],
    queryFn: () => getSummon(summonId),
    enabled: Number.isFinite(summonId),
  })

  const summon = query.data
  const [servedOn, setServedOn] = useState('')
  const [dwelling, setDwelling] = useState('')
  const [office, setOffice] = useState('')
  const [officer, setOfficer] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!summon) return
    setServedOn(toDatetimeLocalValue(summon.served_on))
    setDwelling(summon.dwelling_recipient ?? '')
    setOffice(summon.office_recipient ?? '')
    setOfficer(summon.officer_in_charge ?? '')
    setSubmitError(null)
  }, [summon])

  function goBack() {
    navigate('/summon-for-the-respondent')
  }

  async function handleSubmit() {
    if (!Number.isFinite(summonId) || !summon) return
    if (!actorUserId) {
      setSubmitError('You must be signed in.')
      return
    }

    setSaving(true)
    setSubmitError(null)
    try {
      await updateSummon(summonId, actorUserId, {
        appear_at: summon.appear_at,
        served_on: servedOn ? fromDatetimeLocalValue(servedOn) : null,
        dwelling_recipient: dwelling,
        office_recipient: office,
        officer_in_charge: officer,
      })
      await queryClient.invalidateQueries({ queryKey: ['summons'] })
      await queryClient.invalidateQueries({ queryKey: ['summon'] })
      toast.success('Summon updated.')
      goBack()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save this summon.'
      setSubmitError(message)
      toast.error('Unable to save this summon.', message)
    } finally {
      setSaving(false)
    }
  }

  if (!Number.isFinite(summonId)) {
    return (
      <div>
        <Button type="button" variant="outline" className="cursor-pointer" onClick={goBack}>
          Back
        </Button>
        <p className="mt-4 text-sm text-destructive">Summon not found.</p>
      </div>
    )
  }

  if (query.isError) {
    return (
      <div>
        <Button type="button" variant="outline" className="cursor-pointer" onClick={goBack}>
          Back
        </Button>
        <p className="mt-4 text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : 'Unable to load this summon.'}
        </p>
      </div>
    )
  }

  if (query.isLoading || !summon) {
    return (
      <div>
        <Button type="button" variant="outline" className="cursor-pointer" onClick={goBack}>
          Back
        </Button>
        <p className="mt-4 text-sm text-[#666666]">Loading summon...</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={copy.title} description={copy.description} />

      <form
        className="mt-5 grid max-w-3xl gap-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (!readOnly) void handleSubmit()
        }}
        noValidate
      >
        <Field label="Barangay case no." htmlFor="summon-case-no">
          <Input id="summon-case-no" className="h-10 bg-white" value={summon.barangay_case_no || '—'} disabled readOnly />
        </Field>
        <Field label="Respondents" htmlFor="summon-respondents">
          <Input id="summon-respondents" className="h-10 bg-white" value={summon.respondents || '—'} disabled readOnly />
        </Field>
        <Field label="Date issued" htmlFor="summon-issued">
          <Input id="summon-issued" className="h-10 bg-white" value={formatComplaintWhen(summon.issued_on)} disabled readOnly />
        </Field>
        <Field label="Appear on" htmlFor="summon-appear-at">
          <Input
            id="summon-appear-at"
            type="datetime-local"
            className="h-10 bg-white"
            value={toDatetimeLocalValue(summon.appear_at)}
            disabled
            readOnly
          />
        </Field>
        <Field label="Date served" htmlFor="summon-served">
          <Input
            id="summon-served"
            type="datetime-local"
            className="h-10 bg-white"
            value={servedOn}
            disabled={readOnly}
            readOnly={readOnly}
            onChange={(event) => setServedOn(event.target.value)}
          />
        </Field>
        <Field label="Serving Officer" htmlFor="summon-officer">
          <Input
            id="summon-officer"
            className="h-10 bg-white"
            value={officer}
            disabled={readOnly}
            readOnly={readOnly}
            placeholder="e.g. PO Juan Dela Cruz"
            onChange={(event) => setOfficer(event.target.value)}
          />
        </Field>
        <Field label="Dwelling recipient" htmlFor="summon-dwelling">
          <Input
            id="summon-dwelling"
            className="h-10 bg-white"
            value={dwelling}
            disabled={readOnly}
            readOnly={readOnly}
            placeholder="e.g. Maria Dela Cruz"
            onChange={(event) => setDwelling(event.target.value)}
          />
        </Field>
        <Field label="Office recipient" htmlFor="summon-office">
          <Input
            id="summon-office"
            className="h-10 bg-white"
            value={office}
            disabled={readOnly}
            readOnly={readOnly}
            placeholder="e.g. Reception desk"
            onChange={(event) => setOffice(event.target.value)}
          />
        </Field>
        <SummonAttachments
          summonId={summonId}
          attachments={summon.attachments}
          actorUserId={actorUserId}
          readOnly={readOnly}
          onChanged={async () => {
            await queryClient.invalidateQueries({ queryKey: ['summon', summonId] })
          }}
        />

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={goBack}>
            Back
          </Button>
          {readOnly ? null : (
            <Button type="submit" className="cursor-pointer" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

function SummonAttachments({
  summonId,
  attachments,
  actorUserId,
  readOnly,
  onChanged,
}: {
  summonId: number
  attachments: SummonAttachment[]
  actorUserId: number | undefined
  readOnly: boolean
  onChanged: () => Promise<void>
}) {
  const confirm = useConfirm()
  const inputRef = useRef<HTMLInputElement>(null)
  const [openingId, setOpeningId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleOpen(attachment: SummonAttachment) {
    setOpeningId(attachment.id)
    try {
      const url = await getSummonAttachmentUrl(attachment.file_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error('Unable to open attachment.', error instanceof Error ? error.message : undefined)
    } finally {
      setOpeningId(null)
    }
  }

  async function handleUpload(fileList: FileList | null) {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return
    if (!actorUserId) {
      toast.error('Unable to upload attachment.', 'You must be signed in.')
      return
    }

    setBusy(true)
    try {
      for (const file of files) {
        const uploaded = await uploadSummonAttachment(summonId, file)
        await addSummonAttachment(summonId, actorUserId, uploaded.path, uploaded.fileName)
      }
      await onChanged()
      toast.success(files.length === 1 ? 'Attachment uploaded.' : 'Attachments uploaded.')
    } catch (error) {
      toast.error(
        'Unable to upload attachment.',
        error instanceof Error ? error.message : undefined,
      )
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(attachment: SummonAttachment) {
    const ok = await confirm({
      title: 'Delete this attachment?',
      description: `This will permanently delete “${attachment.file_name}”.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return
    if (!actorUserId) {
      toast.error('Unable to delete attachment.', 'You must be signed in.')
      return
    }

    setBusy(true)
    try {
      await deleteSummonAttachment(attachment.id, actorUserId)
      await onChanged()
      toast.success('Attachment deleted.')
    } catch (error) {
      toast.error(
        'Unable to delete attachment.',
        error instanceof Error ? error.message : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-[#171717]">Attachments</h2>
        {readOnly ? null : (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => void handleUpload(event.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-[#FAFAFA]">
            <TableHead>File</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attachments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="py-6 text-center text-[#666666]">
                No attachments.
              </TableCell>
            </TableRow>
          ) : (
            attachments.map((attachment) => (
              <TableRow key={attachment.id}>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-2">
                    <FileKindIcon name={attachment.file_name} />
                    <span className="min-w-0 truncate">{attachment.file_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#666666] hover:bg-[#F5F5F5] hover:text-[#171717]"
                      aria-label={`View ${attachment.file_name}`}
                      disabled={openingId === attachment.id}
                      onClick={() => void handleOpen(attachment)}
                    >
                      <Eye className="size-3.5" />
                    </button>
                    {readOnly ? null : (
                      <button
                        type="button"
                        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#666666] hover:bg-[#F5F5F5] hover:text-destructive"
                        aria-label={`Delete ${attachment.file_name}`}
                        disabled={busy}
                        onClick={() => void handleDelete(attachment)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function FileKindIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const Icon = ext === 'pdf' ? FileText : ext === 'doc' || ext === 'docx' ? FileType : File
  return <Icon className="size-4 shrink-0 text-[#666666]" aria-hidden />
}