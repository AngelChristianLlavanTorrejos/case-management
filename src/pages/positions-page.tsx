import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { IconInput } from '@/components/ui/icon-input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast.tsx'
import { listPositions } from '@/lib/positions-api'

export function PositionsPage() {
  const [search, setSearch] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [sorted, setSorted] = useState(false)

  const listQuery = useQuery({
    queryKey: ['positions'],
    queryFn: listPositions,
  })

  useEffect(() => {
    if (listQuery.isError) {
      toast.error(
        'Unable to load positions.',
        listQuery.error instanceof Error ? listQuery.error.message : undefined,
      )
    }
  }, [listQuery.error, listQuery.isError])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = (listQuery.data ?? []).filter((row) => row.name.toLowerCase().includes(query))
    return filtered.slice().sort((a, b) => {
      if (!sorted) return a.sort_order - b.sort_order
      const compared = a.name.localeCompare(b.name, 'en')
      return sortDir === 'asc' ? compared : -compared
    })
  }, [listQuery.data, search, sortDir, sorted])

  return (
    <div>
      <PageHeader title="Positions" description="View the lupon and barangay positions." />

      <div className="mt-5 w-full min-w-48 sm:max-w-xs">
        <IconInput
          icon={<Search />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="e.g. Lupon Member"
          aria-label="Search"
        />
      </div>

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-[#FAFAFA]">
              <TableHead>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1 hover:text-[#171717]"
                  onClick={() => {
                    setSorted(true)
                    setSortDir((current) => (sorted && current === 'asc' ? 'desc' : 'asc'))
                  }}
                >
                  Position
                  {sorted ? (
                    sortDir === 'asc' ? (
                      <ArrowUp className="size-3.5" />
                    ) : (
                      <ArrowDown className="size-3.5" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3.5 text-[#A3A3A3]" />
                  )}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading ? (
              <TableRow>
                <TableCell className="py-10 text-center text-[#666666]">Loading records...</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell className="py-10 text-center text-[#666666]">No records found.</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
