import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileDown, Megaphone } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageContent, type PageContentAction, type SortDir } from '@/components/data/page-content'
import { AddMotionForExecutionDialog } from '@/components/motion/add-motion-for-execution-dialog'
import { IssueNoticeOfHearingMotionDialog } from '@/components/motion/issue-notice-of-hearing-motion-dialog'
import { toast } from '@/hooks/use-toast.tsx'
import { formatComplaintWhen } from '@/lib/complaints-api'
import { placeholders } from '@/lib/form-fields'
import { listMotionsForExecution, type MotionListRow } from '@/lib/motion-for-execution-api'
import { downloadMotionForExecutionPdf } from '@/lib/motion-for-execution-pdf'
import { useAuthStore } from '@/stores/auth-store'

const PAGE_SIZE = 10

function TruncatedNames({ value }: { value: string }) {
  return (
    <span className="block max-w-56 truncate" title={value}>
      {value || '—'}
    </span>
  )
}

export function MotionForExecutionPage() {
  const queryClient = useQueryClient()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [issueMotionId, setIssueMotionId] = useState<number | null>(null)

  const listQuery = useQuery({
    queryKey: ['motions-for-execution', search, sortKey, sortDir, page],
    queryFn: () =>
      listMotionsForExecution({
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
        'Unable to load motions for execution.',
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

  const actions: PageContentAction<MotionListRow>[] = [
    {
      label: 'Export PDF',
      icon: FileDown,
      onSelect: (row) => {
        void downloadMotionForExecutionPdf(row.id).catch((error) => {
          toast.error(
            'Unable to export PDF.',
            error instanceof Error ? error.message : undefined,
          )
        })
      },
    },
    {
      label: 'Issue Notice of Hearing (RE: Motion for Execution)',
      icon: Megaphone,
      hidden: (row) => row.has_notice,
      onSelect: (row) => setIssueMotionId(row.id),
    },
  ]

  return (
    <>
      <PageContent
        title="Motion for Execution"
        description="Request execution for settlements that are final after ten days."
        searchPlaceholder={placeholders.search_motion}
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
      <AddMotionForExecutionDialog
        open={addOpen}
        actorUserId={actorUserId}
        onClose={() => setAddOpen(false)}
        onCreated={async () => {
          await queryClient.invalidateQueries({ queryKey: ['motions-for-execution'] })
          await queryClient.invalidateQueries({ queryKey: ['motion-for-execution-cases'] })
          await queryClient.invalidateQueries({ queryKey: ['amicable-settlements'] })
        }}
      />
      <IssueNoticeOfHearingMotionDialog
        motionId={issueMotionId}
        actorUserId={actorUserId}
        onClose={() => setIssueMotionId(null)}
        onIssued={async () => {
          await queryClient.invalidateQueries({ queryKey: ['motions-for-execution'] })
          await queryClient.invalidateQueries({ queryKey: ['notices-of-hearing-motion'] })
          await queryClient.invalidateQueries({ queryKey: ['amicable-settlements'] })
        }}
      />
    </>
  )
}
