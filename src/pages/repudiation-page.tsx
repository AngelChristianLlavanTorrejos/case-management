import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileCheck, FileDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageContent, type PageContentAction, type SortDir } from '@/components/data/page-content'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast.tsx'
import { formatComplaintWhen } from '@/lib/complaints-api'
import { placeholders } from '@/lib/form-fields'
import {
  listRepudiations,
  markRepudiationReceivedAndFiled,
  type RepudiationListRow,
} from '@/lib/repudiation-api'
import { downloadRepudiationPdf } from '@/lib/repudiation-pdf'
import { isUserRole } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

const PAGE_SIZE = 10

function TruncatedNames({ value }: { value: string }) {
  return (
    <span className="block max-w-56 truncate" title={value}>
      {value || '—'}
    </span>
  )
}

export function RepudiationPage() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const isUser = isUserRole(useAuthStore((state) => state.session?.roleName))
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  const listQuery = useQuery({
    queryKey: ['repudiations', actorUserId, search, sortKey, sortDir, page],
    queryFn: () =>
      listRepudiations({
        actorUserId: actorUserId as number,
        search,
        sortKey,
        sortDir,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: Boolean(actorUserId),
  })

  const rows = listQuery.data?.rows ?? []
  const total = listQuery.data?.total ?? 0

  useEffect(() => {
    if (listQuery.isError) {
      toast.error(
        'Unable to load repudiations.',
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

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'created_at' ? 'desc' : 'asc')
  }

  async function handleReceivedAndFiled(row: RepudiationListRow) {
    const ok = await confirm({
      title: 'Mark as received and filed?',
      description: 'This will set Received and filed to Yes.',
      confirmLabel: 'Received and filed',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await markRepudiationReceivedAndFiled(row.id, actorUserId, row.complaint_id)
      await queryClient.invalidateQueries({ queryKey: ['repudiations'] })
      toast.success('Repudiation marked as received and filed.')
    } catch (error) {
      toast.error(
        'Unable to mark this repudiation as received and filed.',
        error instanceof Error ? error.message : undefined,
      )
    }
  }

  const actions: PageContentAction<RepudiationListRow>[] = [
    {
      label: 'Received and filed',
      icon: FileCheck,
      onSelect: (row) => void handleReceivedAndFiled(row),
      hidden: (row) => isUser || row.is_received_and_filed,
    },
    {
      label: 'Export PDF',
      icon: FileDown,
      onSelect: (row) => {
        if (!actorUserId) return
        void downloadRepudiationPdf(row.id, actorUserId).catch((error) => {
          toast.error(
            'Unable to export PDF.',
            error instanceof Error ? error.message : undefined,
          )
        })
      },
    },
  ]

  return (
    <PageContent
      title="Repudiation"
      description="Record repudiations of settlements created within the last ten days."
      searchPlaceholder={placeholders.search_repudiation}
      searchValue={search}
      onSearchChange={setSearch}
      addLabel="Add"
      onAdd={() => navigate('/repudiation/add')}
      columns={[
        { key: 'barangay_case_no', header: 'Barangay case no.', sortable: true, className: 'w-44' },
        {
          key: 'complainants',
          header: 'Complainants',
          sortable: true,
          className: 'max-w-56',
          render: (row) => <TruncatedNames value={row.complainants} />,
        },
        {
          key: 'respondents',
          header: 'Respondents',
          sortable: true,
          className: 'max-w-56',
          render: (row) => <TruncatedNames value={row.respondents} />,
        },
        {
          key: 'is_received_and_filed',
          header: 'Received and filed',
          className: 'w-40',
          render: (row) => (row.is_received_and_filed ? 'Yes' : 'No'),
        },
        {
          key: 'created_at',
          header: 'Date created',
          sortable: true,
          className: 'w-48',
          render: (row) => formatComplaintWhen(row.created_at),
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
  )
}
