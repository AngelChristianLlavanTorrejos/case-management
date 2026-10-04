import { useQuery } from '@tanstack/react-query'
import { Eye, FileDown, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageContent, type PageContentAction, type SortDir } from '@/components/data/page-content'
import { toast } from '@/hooks/use-toast.tsx'
import { formatComplaintWhen } from '@/lib/complaints-api'
import { placeholders } from '@/lib/form-fields'
import { listSummons, type SummonListRow } from '@/lib/hearing-summon-api'
import { downloadSummonPdf } from '@/lib/summon-pdf'
import { useAuthStore } from '@/stores/auth-store'

const PAGE_SIZE = 10

function TruncatedNames({ value }: { value: string }) {
  return (
    <span className="block max-w-56 truncate" title={value}>
      {value || '—'}
    </span>
  )
}

export function SummonForRespondentPage() {
  const navigate = useNavigate()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('issued_on')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  const listQuery = useQuery({
    queryKey: ['summons', search, sortKey, sortDir, page],
    queryFn: () =>
      listSummons({
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
        'Unable to load summons.',
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
    setSortDir(key === 'issued_on' || key === 'appear_at' ? 'desc' : 'asc')
  }

  const actions: PageContentAction<SummonListRow>[] = [
    { label: 'View', icon: Eye, onSelect: (row) => navigate(`/summon-for-the-respondent/${row.id}/view`) },
    { label: 'Edit', icon: Pencil, onSelect: (row) => navigate(`/summon-for-the-respondent/${row.id}/edit`) },
    {
      label: 'Export PDF',
      icon: FileDown,
      onSelect: (row) => {
        if (!actorUserId) return
        void downloadSummonPdf(row.id, actorUserId).catch((error) => {
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
      title="Summon for the Respondent"
      description="Issue and track summons for respondents on received and filed complaints."
      searchPlaceholder={placeholders.search_summon}
      searchValue={search}
      onSearchChange={setSearch}
      columns={[
        { key: 'barangay_case_no', header: 'Barangay case no.', sortable: true, className: 'w-44' },
        {
          key: 'respondents',
          header: 'Respondents',
          sortable: true,
          className: 'max-w-56',
          render: (row) => <TruncatedNames value={row.respondents} />,
        },
        {
          key: 'appear_at',
          header: 'Appear on',
          sortable: true,
          className: 'w-48',
          render: (row) => formatComplaintWhen(row.appear_at),
        },
        {
          key: 'issued_on',
          header: 'Date issued',
          sortable: true,
          className: 'w-48',
          render: (row) => formatComplaintWhen(row.issued_on),
        },
        {
          key: 'served_on',
          header: 'Date served',
          sortable: true,
          className: 'w-48',
          render: (row) => (row.served_on ? formatComplaintWhen(row.served_on) : '—'),
        },
        {
          key: 'officer_in_charge',
          header: 'Serving Officer',
          sortable: true,
          render: (row) => row.officer_in_charge || '—',
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
