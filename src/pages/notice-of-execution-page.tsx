import { useQuery } from '@tanstack/react-query'
import { FileDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageContent, type PageContentAction, type SortDir } from '@/components/data/page-content'
import { toast } from '@/hooks/use-toast.tsx'
import { formatComplaintWhen } from '@/lib/complaints-api'
import { placeholders } from '@/lib/form-fields'
import {
  formatPartyObliged,
  listNoticesOfExecution,
  type ExecutionListRow,
} from '@/lib/notice-of-execution-api'
import { downloadNoticeOfExecutionPdf } from '@/lib/notice-of-execution-pdf'

const PAGE_SIZE = 10

function TruncatedNames({ value }: { value: string }) {
  return (
    <span className="block max-w-56 truncate" title={value}>
      {value || '—'}
    </span>
  )
}

export function NoticeOfExecutionPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  const listQuery = useQuery({
    queryKey: ['notices-of-execution', search, sortKey, sortDir, page],
    queryFn: () =>
      listNoticesOfExecution({
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
        'Unable to load notices of execution.',
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

  const actions: PageContentAction<ExecutionListRow>[] = [
    {
      label: 'Export PDF',
      icon: FileDown,
      onSelect: (row) => {
        void downloadNoticeOfExecutionPdf(row.id).catch((error) => {
          toast.error(
            'Unable to export PDF.',
            error instanceof Error ? error.message : undefined,
          )
        })
      },
    },
  ]

  return (
    <>
      <PageContent
        title="Notice of Execution"
        description="Issue a notice of execution after five days from the motion hearing if the settlement is still unpaid."
        searchPlaceholder={placeholders.search_execution}
        searchValue={search}
        onSearchChange={setSearch}
        addLabel="Add"
        onAdd={() => navigate('/notice-of-execution/add')}
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
            key: 'party_obliged',
            header: 'Party obliged',
            sortable: true,
            className: 'w-36',
            render: (row) => formatPartyObliged(row.party_obliged),
          },
          {
            key: 'amount',
            header: 'The sum of',
            sortable: true,
            className: 'max-w-44',
            render: (row) => <TruncatedNames value={row.amount} />,
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
    </>
  )
}
