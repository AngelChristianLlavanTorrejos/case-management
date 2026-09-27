import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Eye, Pencil, Trash2, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageContent, type PageContentAction, type SortDir } from '@/components/data/page-content'
import { PageHeader } from '@/components/layout/page-header'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast.tsx'
import { formatStatusLabel, placeholders } from '@/lib/form-fields'
import {
  allowCommunityMember,
  deleteCommunityMember,
  listCommunityMembers,
  restrictCommunityMember,
  type CommunityMemberListRow,
} from '@/lib/community-members-api'
import { useAuthStore } from '@/stores/auth-store'

const PAGE_SIZE = 10

export function CommunityMembersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('display_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)

  const listQuery = useQuery({
    queryKey: ['community-members', search, sortKey, sortDir, page],
    queryFn: () =>
      listCommunityMembers({
        statusGroup: 'residents',
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
        'Unable to load community members.',
        listQuery.error instanceof Error ? listQuery.error.message : undefined,
      )
    }
  }, [listQuery.error, listQuery.isError])

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
    if (page > pageCount) {
      setPage(pageCount)
    }
  }, [page, total])

  async function invalidateList() {
    await queryClient.invalidateQueries({ queryKey: ['community-members'] })
  }

  async function handleRestrict(row: CommunityMemberListRow) {
    const ok = await confirm({
      title: 'Restrict this resident?',
      description: `${row.display_name} will no longer be able to sign in.`,
      confirmLabel: 'Restrict',
      variant: 'destructive',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await restrictCommunityMember(row.id, actorUserId)
      await invalidateList()
      toast.success('Resident restricted.')
    } catch (error) {
      toast.error('Unable to restrict this resident.', error instanceof Error ? error.message : undefined)
    }
  }

  async function handleAllow(row: CommunityMemberListRow) {
    const ok = await confirm({
      title: 'Allow this resident?',
      description: `${row.display_name} will be active and able to sign in again.`,
      confirmLabel: 'Allow',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await allowCommunityMember(row.id, actorUserId)
      await invalidateList()
      toast.success('Resident allowed.')
    } catch (error) {
      toast.error('Unable to allow this resident.', error instanceof Error ? error.message : undefined)
    }
  }

  async function handleDelete(row: CommunityMemberListRow) {
    const ok = await confirm({
      title: 'Delete this resident?',
      description: `This will permanently delete ${row.display_name} and their personal records.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await deleteCommunityMember(row.id, actorUserId)
      await invalidateList()
      toast.success('Resident deleted.')
    } catch (error) {
      toast.error('Unable to delete this resident.', error instanceof Error ? error.message : undefined)
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

  const residentActions: PageContentAction<CommunityMemberListRow>[] = [
    { label: 'View', icon: Eye, onSelect: (row) => navigate(`/community-members/${row.id}/view`) },
    { label: 'Edit', icon: Pencil, onSelect: (row) => navigate(`/community-members/${row.id}/edit`) },
    { label: 'Delete', icon: Trash2, onSelect: (row) => void handleDelete(row), variant: 'destructive' },
    {
      label: 'Restrict',
      icon: Ban,
      onSelect: (row) => void handleRestrict(row),
      variant: 'destructive',
      hidden: (row) => row.status_name.toLowerCase() === 'inactive',
    },
    {
      label: 'Allow',
      icon: UserCheck,
      onSelect: (row) => void handleAllow(row),
      hidden: (row) => row.status_name.toLowerCase() !== 'inactive',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Community Members"
        description="Manage registered members."
      />

      <div className="mt-5">
        <PageContent
          searchPlaceholder={placeholders.search_member}
          searchValue={search}
          onSearchChange={setSearch}
          columns={[
            { key: 'display_name', header: 'Name', sortable: true },
            { key: 'age', header: 'Age', sortable: true, className: 'w-24' },
            { key: 'sex_name', header: 'Sex', sortable: true, className: 'w-28' },
            { key: 'location', header: 'Location', sortable: true },
            {
              key: 'status_name',
              header: 'Status',
              sortable: true,
              className: 'w-36',
              render: (row) => formatStatusLabel(row.status_name),
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
          actions={residentActions}
        />
      </div>
    </div>
  )
}
