import { useQuery } from '@tanstack/react-query'
import { FileDown } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageContent, type PageContentAction, type SortDir } from '@/components/data/page-content'
import { toast } from '@/hooks/use-toast.tsx'
import { formatComplaintWhen } from '@/lib/complaints-api'
import { placeholders } from '@/lib/form-fields'
import {
  formatFiledBy,
  listNoticesOfHearingMotion,
  type NoticeMotionListRow,
} from '@/lib/notice-of-hearing-motion-api'
import { downloadNoticeOfHearingMotionPdf } from '@/lib/notice-of-hearing-motion-pdf'

const PAGE_SIZE = 10

function TruncatedNames({ value }: { value: string }) {
  return (
    <span className="block max-w-56 truncate" title={value}>
      {value || '—'}
    </span>
  )
}

export function NoticeOfHearingMotionPage() {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('issued_on')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  const listQuery = useQuery({
    queryKey: ['notices-of-hearing-motion', search, sortKey, sortDir, page],
    queryFn: () =>
      listNoticesOfHearingMotion({
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
        'Unable to load notices of hearing (motion).',
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

  const actions: PageContentAction<NoticeMotionListRow>[] = [
    {
      label: 'Export PDF',
      icon: FileDown,
      onSelect: (row) => {
        void downloadNoticeOfHearingMotionPdf(row.id).catch((error) => {
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
      title="Notice of Hearing (RE: Motion for Execution)"
      description="Review notices issued for motions for execution."
      searchPlaceholder={placeholders.search_notice_motion}
      searchValue={search}
      onSearchChange={setSearch}
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
          key: 'appear_at',
          header: 'Appear on',
          sortable: true,
          className: 'w-48',
          render: (row) => formatComplaintWhen(row.appear_at),
        },
        {
          key: 'filed_by',
          header: 'Filed by',
          sortable: true,
          className: 'w-36',
          render: (row) => formatFiledBy(row.filed_by),
        },
        {
          key: 'issued_on',
          header: 'Date issued',
          sortable: true,
          className: 'w-48',
          render: (row) => formatComplaintWhen(row.issued_on),
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
