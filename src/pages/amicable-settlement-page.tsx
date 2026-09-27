import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileDown } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageContent, type PageContentAction, type SortDir } from '@/components/data/page-content'
import { AddAmicableSettlementDialog } from '@/components/settlement/add-amicable-settlement-dialog'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast.tsx'
import {
  listAmicableSettlements,
  markAmicableSettlementSettled,
  type AmicableSettlementListRow,
} from '@/lib/amicable-settlement-api'
import { downloadAmicableSettlementPdf } from '@/lib/amicable-settlement-pdf'
import { formatComplaintWhen } from '@/lib/complaints-api'
import { placeholders } from '@/lib/form-fields'
import { useAuthStore } from '@/stores/auth-store'

const PAGE_SIZE = 10

function TruncatedNames({ value }: { value: string }) {
  return (
    <span className="block max-w-56 truncate" title={value}>
      {value || '—'}
    </span>
  )
}

function formatSettlementStatus(status: string | null) {
  if (status === 'settled') return 'Settled'
  if (status === 'repudiated') return 'Repudiated'
  if (status === 'motion_for_execution') return 'Motion for Execution'
  return '—'
}

export function AmicableSettlementPage() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)

  const listQuery = useQuery({
    queryKey: ['amicable-settlements', search, sortKey, sortDir, page],
    queryFn: () =>
      listAmicableSettlements({
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
        'Unable to load amicable settlements.',
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

  async function handleSettled(row: AmicableSettlementListRow) {
    const ok = await confirm({
      title: 'Mark this settlement as settled?',
      description: 'This will close the case. It can no longer be repudiated.',
      confirmLabel: 'Settled',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await markAmicableSettlementSettled(row.id, actorUserId)
      await queryClient.invalidateQueries({ queryKey: ['amicable-settlements'] })
      await queryClient.invalidateQueries({ queryKey: ['repudiation-cases'] })
      await queryClient.invalidateQueries({ queryKey: ['motion-for-execution-cases'] })
      toast.success('Settlement marked as settled.')
    } catch (error) {
      toast.error(
        'Unable to mark this settlement as settled.',
        error instanceof Error ? error.message : undefined,
      )
    }
  }

  const actions: PageContentAction<AmicableSettlementListRow>[] = [
    {
      label: 'Export PDF',
      icon: FileDown,
      onSelect: (row) => {
        void downloadAmicableSettlementPdf(row.id).catch((error) => {
          toast.error(
            'Unable to export PDF.',
            error instanceof Error ? error.message : undefined,
          )
        })
      },
    },
    {
      label: 'Settled',
      icon: Check,
      hidden: (row) => Boolean(row.status) || row.is_settled,
      onSelect: (row) => {
        void handleSettled(row)
      },
    },
  ]

  return (
    <>
      <PageContent
        title="Amicable Settlement"
        description="Record settlements for cases that already have a notice and summon."
        searchPlaceholder={placeholders.search_settlement}
        searchValue={search}
        onSearchChange={setSearch}
        addLabel="Add"
        onAdd={() => setAddOpen(true)}
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
            key: 'status',
            header: 'Status',
            sortable: true,
            className: 'w-48',
            render: (row) => formatSettlementStatus(row.status),
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
      <AddAmicableSettlementDialog
        open={addOpen}
        actorUserId={actorUserId}
        onClose={() => setAddOpen(false)}
        onCreated={async () => {
          await queryClient.invalidateQueries({ queryKey: ['amicable-settlements'] })
          await queryClient.invalidateQueries({ queryKey: ['amicable-settlement-cases'] })
        }}
      />
    </>
  )
}
