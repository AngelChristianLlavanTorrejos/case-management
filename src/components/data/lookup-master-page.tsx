import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Filter, Type } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import { PageContent, type SortDir } from '@/components/data/page-content'
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
import { IconInput } from '@/components/ui/icon-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast.tsx'
import { placeholders } from '@/lib/form-fields'
import {
  createLookup,
  deleteLookup,
  listLookups,
  updateLookup,
  type LookupKind,
  type LookupRow,
} from '@/lib/lookup-api'
import { lookupNameSchema, type LookupNameValues } from '@/schemas/lookup'
import { useAuthStore } from '@/stores/auth-store'

const PAGE_SIZE = 10

type LookupMasterPageProps = {
  kind: LookupKind
  title: string
  description: string
  addLabel: string
}

export function LookupMasterPage({ kind, title, description, addLabel }: LookupMasterPageProps) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | 'system' | 'custom'>('all')
  const [sortKey, setSortKey] = useState<'name' | 'can_delete'>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LookupRow | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['lookups', kind, search, type, sortKey, sortDir, page],
    queryFn: () =>
      listLookups(kind, {
        search,
        type,
        sortKey,
        sortDir,
        page,
        pageSize: PAGE_SIZE,
      }),
  })

  const form = useForm<LookupNameValues>({
    resolver: zodResolver(lookupNameSchema),
    defaultValues: { name: '' },
  })

  const rows = listQuery.data?.rows ?? []
  const total = listQuery.data?.total ?? 0

  useEffect(() => {
    setPage(1)
  }, [search, type])

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
    if (page > pageCount) {
      setPage(pageCount)
    }
  }, [page, total])

  const saveMutation = useMutation({
    mutationFn: async (values: LookupNameValues) => {
      if (!actorUserId) throw new Error('You must be signed in.')
      if (editing) {
        await updateLookup(kind, editing.id, values.name, actorUserId)
        return 'updated' as const
      }
      await createLookup(kind, values.name, actorUserId)
      return 'created' as const
    },
    onSuccess: async (action) => {
      setFormOpen(false)
      setEditing(null)
      await queryClient.invalidateQueries({ queryKey: ['lookups', kind] })
      toast.success(
        action === 'updated' ? `${title} updated.` : `${title} created.`,
      )
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to save record.'
      setSubmitError(message)
      toast.error('Unable to save record.', message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (row: LookupRow) => {
      if (!actorUserId) throw new Error('You must be signed in.')
      await deleteLookup(kind, row.id, actorUserId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lookups', kind] })
      toast.success(`${title} deleted.`)
    },
    onError: (error) => {
      toast.error(
        'Unable to delete this record.',
        error instanceof Error ? error.message : undefined,
      )
    },
  })

  function openAdd() {
    setEditing(null)
    setSubmitError(null)
    form.reset({ name: '' })
    setFormOpen(true)
  }

  function openEdit(row: LookupRow) {
    setEditing(row)
    setSubmitError(null)
    form.reset({ name: row.name })
    setFormOpen(true)
  }

  async function handleEditSave(values: LookupNameValues) {
    if (!editing) return

    setFormOpen(false)
    await new Promise((resolve) => window.setTimeout(resolve, 80))

    const confirmed = await confirm({
      title: `Save ${title} changes`,
      description: `Update “${editing.name}” to “${values.name}”?`,
      confirmLabel: 'Save',
    })

    if (!confirmed) {
      setFormOpen(true)
      return
    }

    try {
      await saveMutation.mutateAsync(values)
    } catch {
      setFormOpen(true)
    }
  }

  async function handleDelete(row: LookupRow) {
    const confirmed = await confirm({
      title: `Delete ${title}`,
      description: `Delete “${row.name}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    })

    if (!confirmed) return
    deleteMutation.mutate(row)
  }

  function handleSort(key: string) {
    const nextKey = key === 'can_delete' ? 'can_delete' : 'name'
    if (sortKey === nextKey) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(nextKey)
    setSortDir('asc')
  }

  return (
    <>
      <PageContent
        title={title}
        description={description}
        searchPlaceholder={kind === 'suffix' ? placeholders.lookup_suffix : placeholders.lookup_civil_status}
        searchValue={search}
        onSearchChange={setSearch}
        filters={
          <Select
            value={type}
            onValueChange={(value) => setType(value as 'all' | 'system' | 'custom')}
          >
            <SelectTrigger className="min-w-36 cursor-pointer">
              <Filter className="size-4 text-[#666666]" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        }
        addLabel={addLabel}
        onAdd={openAdd}
        columns={[
          { key: 'name', header: 'Name', sortable: true },
          {
            key: 'can_delete',
            header: 'Type',
            sortable: true,
            render: (row) => (row.can_delete ? 'Custom' : 'System'),
          },
        ]}
        rows={rows}
        isLoading={listQuery.isLoading}
        getRowId={(row) => row.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
        onEdit={openEdit}
        onDelete={handleDelete}
        canEdit={(row) => row.can_delete}
        canDelete={(row) => row.can_delete}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${title}` : addLabel}</DialogTitle>
            <DialogDescription>
              {editing ? `Update the ${title.toLowerCase()} name.` : `Add a new ${title.toLowerCase()} record.`}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit((values) => {
              setSubmitError(null)
              if (editing) {
                void handleEditSave(values)
                return
              }
              saveMutation.mutate(values)
            })}
          >
            <Field label="Name" htmlFor={`${kind}-name`} required error={form.formState.errors.name?.message}>
              <IconInput
                id={`${kind}-name`}
                icon={<Type />}
                {...form.register('name')}
                placeholder={kind === 'suffix' ? placeholders.lookup_suffix : placeholders.lookup_civil_status}
              />
            </Field>
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="cursor-pointer" disabled={saveMutation.isPending}>
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
