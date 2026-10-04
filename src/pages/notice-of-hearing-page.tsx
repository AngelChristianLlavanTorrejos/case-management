import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Eye, FileDown } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageContent, type PageContentAction, type SortDir } from '@/components/data/page-content'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast.tsx'
import { formatComplaintWhen } from '@/lib/complaints-api'
import { placeholders } from '@/lib/form-fields'
import {
  acknowledgeNoticeOfHearing,
  getNoticeOfHearing,
  listNoticesOfHearing,
  type HearingListRow,
} from '@/lib/hearing-summon-api'
import { downloadNoticeOfHearingPdf } from '@/lib/notice-of-hearing-pdf'
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[#666666]">{label}</p>
      <p className="mt-0.5 text-sm text-[#171717]">{value || '—'}</p>
    </div>
  )
}

export function NoticeOfHearingPage() {
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const isUser = isUserRole(useAuthStore((state) => state.session?.roleName))
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('issued_on')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [viewId, setViewId] = useState<number | null>(null)

  const listQuery = useQuery({
    queryKey: ['notices-of-hearing', actorUserId, search, sortKey, sortDir, page],
    queryFn: () =>
      listNoticesOfHearing({
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
        'Unable to load notices of hearing.',
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

  async function handleAcknowledge(row: HearingListRow) {
    const ok = await confirm({
      title: 'Acknowledge this notice?',
      description: 'This will set Date acknowledged to today.',
      confirmLabel: 'Acknowledge',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await acknowledgeNoticeOfHearing(row.id, actorUserId, row.appear_at)
      await queryClient.invalidateQueries({ queryKey: ['notices-of-hearing'] })
      await queryClient.invalidateQueries({ queryKey: ['notice-of-hearing'] })
      toast.success('Notice of hearing acknowledged.')
    } catch (error) {
      toast.error(
        'Unable to acknowledge this notice.',
        error instanceof Error ? error.message : undefined,
      )
    }
  }

  const actions: PageContentAction<HearingListRow>[] = [
    { label: 'View', icon: Eye, onSelect: (row) => setViewId(row.id) },
    {
      label: 'Acknowledge',
      icon: Check,
      onSelect: (row) => void handleAcknowledge(row),
      hidden: (row) => !isUser || Boolean(row.acknowledged_on),
    },
    {
      label: 'Export PDF',
      icon: FileDown,
      onSelect: (row) => {
        if (!actorUserId) return
        void downloadNoticeOfHearingPdf(row.id, actorUserId).catch((error) => {
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
        title="Notice of Hearing"
        description="Issue and track notices of hearing for received and filed complaints."
        searchPlaceholder={placeholders.search_notice}
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
            key: 'acknowledged_on',
            header: 'Date acknowledged',
            sortable: true,
            className: 'w-48',
            render: (row) => (row.acknowledged_on ? formatComplaintWhen(row.acknowledged_on) : '—'),
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
      <NoticeViewDialog noticeId={viewId} onClose={() => setViewId(null)} />
    </>
  )
}

function NoticeViewDialog({
  noticeId,
  onClose,
}: {
  noticeId: number | null
  onClose: () => void
}) {
  const actorUserId = useAuthStore((state) => state.session?.id)
  const query = useQuery({
    queryKey: ['notice-of-hearing', noticeId, actorUserId],
    queryFn: () => getNoticeOfHearing(noticeId as number, actorUserId as number),
    enabled: noticeId !== null && Boolean(actorUserId),
  })
  const notice = query.data

  return (
    <Dialog open={noticeId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>View notice of hearing</DialogTitle>
          <DialogDescription>Read-only details for this notice.</DialogDescription>
        </DialogHeader>
        {query.isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            {query.error instanceof Error ? query.error.message : 'Unable to load this notice.'}
          </p>
        ) : query.isLoading || !notice ? (
          <p className="py-8 text-center text-sm text-[#666666]">Loading notice...</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Barangay case no." value={notice.barangay_case_no ?? ''} />
            <DetailItem label="Complainants" value={notice.complainants} />
            <DetailItem label="Appear on" value={formatComplaintWhen(notice.appear_at)} />
            <DetailItem label="Date issued" value={formatComplaintWhen(notice.issued_on)} />
            <DetailItem label="Date acknowledged" value={notice.acknowledged_on ? formatComplaintWhen(notice.acknowledged_on) : '—'} />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

