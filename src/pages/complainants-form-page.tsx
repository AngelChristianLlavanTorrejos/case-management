import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, FileCheck, FileText, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { IssueNoticeSummonDialog } from '@/components/complaints/issue-notice-summon-dialog'
import { PageContent, type PageContentAction, type SortDir } from '@/components/data/page-content'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast.tsx'
import {
  deleteComplaint,
  formatComplaintWhen,
  formatNoticeDueCountdown,
  listComplaints,
  markComplaintReceivedAndFiled,
  type ComplaintListRow,
} from '@/lib/complaints-api'
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

function NoticeDueTag({ row, now }: { row: ComplaintListRow; now: number }) {
  const label = formatNoticeDueCountdown(
    row.received_and_filed_at,
    now,
    row.notice_and_summon_issued_at,
    row.is_notice_and_summon_issued,
  )
  if (label === 'On time') return <span className="text-primary">On time</span>
  if (label === 'Overdue') return <span className="text-destructive">Overdue</span>
  return label
}

export function ComplainantsFormPage() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [now, setNow] = useState(() => Date.now())
  const [issueId, setIssueId] = useState<number | null>(null)

  const listQuery = useQuery({
    queryKey: ['complaints', search, sortKey, sortDir, page],
    queryFn: () =>
      listComplaints({
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
        'Unable to load complaints.',
        listQuery.error instanceof Error ? listQuery.error.message : undefined,
      )
    }
  }, [listQuery.error, listQuery.isError])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
    if (page > pageCount) {
      setPage(pageCount)
    }
  }, [page, total])

  const deleteMutation = useMutation({
    mutationFn: async (row: ComplaintListRow) => {
      if (!actorUserId) throw new Error('You must be signed in.')
      await deleteComplaint(row.id, actorUserId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['complaints'] })
      toast.success('Complaint deleted.')
    },
    onError: (error) => {
      toast.error(
        'Unable to delete this complaint.',
        error instanceof Error ? error.message : undefined,
      )
    },
  })

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'created_at' ? 'desc' : 'asc')
  }

  async function handleReceivedAndFiled(row: ComplaintListRow) {
    const ok = await confirm({
      title: 'Mark as received and filed?',
      description: 'This will set Received and filed to Yes.',
      confirmLabel: 'Received and filed',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await markComplaintReceivedAndFiled(row.id, actorUserId)
      await queryClient.invalidateQueries({ queryKey: ['complaints'] })
      await queryClient.invalidateQueries({ queryKey: ['complaint'] })
      toast.success('Complaint marked as received and filed.')
    } catch (error) {
      toast.error(
        'Unable to mark this complaint as received and filed.',
        error instanceof Error ? error.message : undefined,
      )
    }
  }

  async function handleDelete(row: ComplaintListRow) {
    const ok = await confirm({
      title: 'Delete this complaint?',
      description: 'This will permanently delete the complaint and its listed parties.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return
    deleteMutation.mutate(row)
  }

  const actions: PageContentAction<ComplaintListRow>[] = [
    { label: 'View', icon: Eye, onSelect: (row) => navigate(`/complainants-form/${row.id}/view`) },
    { label: 'Edit', icon: Pencil, onSelect: (row) => navigate(`/complainants-form/${row.id}/edit`) },
    {
      label: 'Received and filed',
      icon: FileCheck,
      onSelect: (row) => void handleReceivedAndFiled(row),
      hidden: (row) => row.is_received_and_filed,
    },
    {
      label: 'Notice of Hearing and Summon',
      icon: FileText,
      onSelect: (row) => setIssueId(row.id),
      hidden: (row) => !row.is_received_and_filed || row.is_notice_and_summon_issued,
    },
    {
      label: 'Delete',
      icon: Trash2,
      onSelect: (row) => void handleDelete(row),
      variant: 'destructive',
    },
  ]

  return (
    <>
    <PageContent
      title="Complainant's Form"
      description="Review and manage filed complaints."
      searchPlaceholder={placeholders.search_complaint}
      searchValue={search}
      onSearchChange={setSearch}
      addLabel="Add"
      onAdd={() => navigate('/complainants-form/add')}
      columns={[
        {
          key: 'created_at',
          header: 'Date',
          sortable: true,
          className: 'w-48',
          render: (row) => formatComplaintWhen(row.created_at),
        },
        { key: 'complaint_type', header: 'Complaint type', sortable: true },
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
          sortable: true,
          className: 'w-40',
          render: (row) => (row.is_received_and_filed ? 'Yes' : 'No'),
        },
        {
          key: 'received_and_filed_at',
          header: 'Notice due',
          sortable: true,
          className: 'w-36',
          render: (row) => <NoticeDueTag row={row} now={now} />,
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
      <IssueNoticeSummonDialog
        complaintId={issueId}
        actorUserId={actorUserId}
        onClose={() => setIssueId(null)}
        onIssued={async () => {
          await queryClient.invalidateQueries({ queryKey: ['complaints'] })
          await queryClient.invalidateQueries({ queryKey: ['complaint'] })
          await queryClient.invalidateQueries({ queryKey: ['notices-of-hearing'] })
          await queryClient.invalidateQueries({ queryKey: ['summons'] })
        }}
      />
    </>
  )
}
