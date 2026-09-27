import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Eye, Pencil, Trash2, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageContent, type PageContentAction, type SortDir } from '@/components/data/page-content'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast.tsx'
import { formatStatusLabel, placeholders } from '@/lib/form-fields'
import {
  allowTechnicalSupport,
  deleteTechnicalSupport,
  listTechnicalSupport,
  restrictTechnicalSupport,
  type TechnicalSupportListRow,
} from '@/lib/technical-support-api'
import { useAuthStore } from '@/stores/auth-store'

const PAGE_SIZE = 10

export function TechnicalSupportPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('display_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)

  const listQuery = useQuery({
    queryKey: ['technical-support', search, sortKey, sortDir, page],
    queryFn: () =>
      listTechnicalSupport({
        search,
        sortKey,
        sortDir,
        page,
        pageSize: PAGE_SIZE,
      }),
  })

  const rows = listQuery.data?.rows ?? []
  const total = listQuery.data?.total ?? 0

  useEffect(() => {
    if (listQuery.isError) {
      toast.error(
        'Unable to load technical support.',
        listQuery.error instanceof Error ? listQuery.error.message : undefined,
      )
    }
  }, [listQuery.error, listQuery.isError])

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
    if (page > pageCount) setPage(pageCount)
  }, [page, total])

  async function invalidateList() {
    await queryClient.invalidateQueries({ queryKey: ['technical-support'] })
    await queryClient.invalidateQueries({ queryKey: ['technical-support-account'] })
  }

  async function handleRestrict(row: TechnicalSupportListRow) {
    const ok = await confirm({
      title: 'Restrict this account?',
      description: `${row.display_name} will no longer be able to sign in.`,
      confirmLabel: 'Restrict',
      variant: 'destructive',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await restrictTechnicalSupport(row.id, actorUserId)
      await invalidateList()
      toast.success('Technical support account restricted.')
    } catch (error) {
      toast.error('Unable to restrict this account.', error instanceof Error ? error.message : undefined)
    }
  }

  async function handleAllow(row: TechnicalSupportListRow) {
    const ok = await confirm({
      title: 'Allow this account?',
      description: `${row.display_name} will be active and able to sign in again.`,
      confirmLabel: 'Allow',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await allowTechnicalSupport(row.id, actorUserId)
      await invalidateList()
      toast.success('Technical support account allowed.')
    } catch (error) {
      toast.error('Unable to allow this account.', error instanceof Error ? error.message : undefined)
    }
  }

  async function handleDelete(row: TechnicalSupportListRow) {
    const ok = await confirm({
      title: 'Delete this account?',
      description: `This will permanently delete ${row.display_name} and their personal records.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await deleteTechnicalSupport(row.id, actorUserId)
      await invalidateList()
      toast.success('Technical support account deleted.')
    } catch (error) {
      toast.error('Unable to delete this account.', error instanceof Error ? error.message : undefined)
    }
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const actions: PageContentAction<TechnicalSupportListRow>[] = [
    { label: 'View', icon: Eye, onSelect: (row) => navigate(`/technical-support/${row.id}/view`) },
    { label: 'Edit', icon: Pencil, onSelect: (row) => navigate(`/technical-support/${row.id}/edit`) },
    {
      label: 'Delete',
      icon: Trash2,
      onSelect: (row) => void handleDelete(row),
      variant: 'destructive',
      hidden: (row) => row.id === actorUserId,
    },
    {
      label: 'Restrict',
      icon: Ban,
      onSelect: (row) => void handleRestrict(row),
      variant: 'destructive',
      hidden: (row) => row.id === actorUserId || row.status_name?.toLowerCase() === 'inactive',
    },
    {
      label: 'Allow',
      icon: UserCheck,
      onSelect: (row) => void handleAllow(row),
      hidden: (row) => row.id === actorUserId || row.status_name?.toLowerCase() !== 'inactive',
    },
  ]

  return (
    <>
      <PageContent
        title="Technical Support"
        description="Super Admin accounts that have no lupon position."
        searchPlaceholder={placeholders.search_technical_support}
        searchValue={search}
        onSearchChange={setSearch}
        addLabel="Add"
        onAdd={() => navigate('/technical-support/add')}
        columns={[
          { key: 'display_name', header: 'Name', sortable: true },
          { key: 'role_name', header: 'Role', sortable: true, className: 'w-40' },
          { key: 'username', header: 'Username', sortable: true, className: 'w-44' },
          {
            key: 'status_name',
            header: 'Status',
            sortable: true,
            className: 'w-36',
            render: (row) => formatStatusLabel(row.status_name ?? ''),
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
        actions={actions}
      />
    </>
  )
}
