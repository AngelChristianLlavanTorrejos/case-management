import { useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageContent, type PageContentAction, type SortDir } from '@/components/data/page-content'
import { PageHeader } from '@/components/layout/page-header'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast.tsx'
import {
  activityLabel,
  formatActivityWhen,
  getActivityLog,
  listActivityLogs,
  type ActivityLogListRow,
} from '@/lib/activity-logs-api'
import { placeholders } from '@/lib/form-fields'

const PAGE_SIZE = 10

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[#666666]">{label}</p>
      <p className="mt-0.5 text-sm text-[#171717]">{value || '—'}</p>
    </div>
  )
}

export function UserActivityLogPage() {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [viewId, setViewId] = useState<number | null>(null)

  const listQuery = useQuery({
    queryKey: ['user-activity-logs', search, sortKey, sortDir, page],
    queryFn: () =>
      listActivityLogs({
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
        'Unable to load activity logs.',
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

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'created_at' ? 'desc' : 'asc')
  }

  const actions: PageContentAction<ActivityLogListRow>[] = [
    {
      label: 'View',
      icon: Eye,
      onSelect: (row) => setViewId(row.id),
    },
  ]

  return (
    <div>
      <PageHeader
        title="User Activity Log"
        description="Review actions taken across the system."
      />

      <div className="mt-5">
        <PageContent
          searchPlaceholder={placeholders.search_activity}
          searchValue={search}
          onSearchChange={setSearch}
          columns={[
            { key: 'user_name', header: 'User', sortable: true },
            {
              key: 'activity',
              header: 'Activity',
              sortable: true,
              className: 'w-36',
              render: (row) => activityLabel(row.activity),
            },
            { key: 'menu_name', header: 'Menu', sortable: true },
            {
              key: 'created_at',
              header: 'Date',
              sortable: true,
              className: 'w-48',
              render: (row) => formatActivityWhen(row.created_at),
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
      </div>

      <ActivityLogViewDialog logId={viewId} onClose={() => setViewId(null)} />
    </div>
  )
}

function ActivityLogViewDialog({
  logId,
  onClose,
}: {
  logId: number | null
  onClose: () => void
}) {
  const logQuery = useQuery({
    queryKey: ['user-activity-log', logId],
    queryFn: () => getActivityLog(logId as number),
    enabled: logId !== null,
  })

  const log = logQuery.data

  return (
    <Dialog
      open={logId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>View activity</DialogTitle>
          <DialogDescription>Human-readable details for this action.</DialogDescription>
        </DialogHeader>
        {logQuery.isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            {logQuery.error instanceof Error ? logQuery.error.message : 'Unable to load activity.'}
          </p>
        ) : logQuery.isLoading || !log ? (
          <p className="py-8 text-center text-sm text-[#666666]">Loading activity...</p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="User" value={log.user_name} />
              <DetailItem label="Activity" value={activityLabel(log.activity)} />
              <DetailItem label="Menu" value={log.menu_name} />
              <DetailItem label="Date" value={formatActivityWhen(log.created_at)} />
            </div>
            <div>
              <p className="text-xs text-[#666666]">Details</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[#171717]">{log.details}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
