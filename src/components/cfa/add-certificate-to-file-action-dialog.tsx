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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast.tsx'
import {
  createCertificateToFileAction,
  listCfaCases,
  type CfaCaseOption,
} from '@/lib/certificate-to-file-action-api'

export function AddCertificateToFileActionDialog({
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
  const [complaintId, setComplaintId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const casesQuery = useQuery({
    queryKey: ['cfa-cases'],
    queryFn: listCfaCases,
    enabled: open,
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

  function reset() {
    setComplaintId('')
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
    if (!complaintId) {
      setError('Barangay case is required.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await createCertificateToFileAction(Number(complaintId), actorUserId)
      await onCreated()
      toast.success('Certificate to file action recorded.')
      reset()
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this certificate.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add certificate to file action</DialogTitle>
          <DialogDescription>
            Choose a barangay case that already has a repudiation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field
            label="Barangay case"
            htmlFor="cfa-case"
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
              <SelectTrigger id="cfa-case" className="h-10 w-full bg-white" aria-invalid={!complaintId && Boolean(error)}>
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
            <p className="text-sm text-[#666666]">No eligible barangay cases. Record a repudiation first.</p>
          ) : null}
          {error && complaintId ? <p className="text-sm text-destructive">{error}</p> : null}
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

function caseLabel(item: CfaCaseOption) {
  return item.barangay_case_no || `Case ${item.id}`
}
