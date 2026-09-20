import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, EllipsisVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import { useEffect, useState, type ReactNode } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { IconInput } from '@/components/ui/icon-input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export type SortDir = 'asc' | 'desc'

export type PageContentColumn<T> = {
  key: string
  header: string
  sortable?: boolean
  className?: string
  render?: (row: T) => ReactNode
}

type PageContentProps<T> = {
  title: string
  description: string
  searchPlaceholder?: string
  searchValue: string
  onSearchChange: (value: string) => void
  filters?: ReactNode
  addLabel: string
  onAdd: () => void
  columns: PageContentColumn<T>[]
  rows: T[]
  isLoading?: boolean
  getRowId: (row: T) => number | string
  sortKey: string
  sortDir: SortDir
  onSort: (key: string) => void
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onEdit: (row: T) => void
  onDelete: (row: T) => void
  canEdit?: (row: T) => boolean
  canDelete?: (row: T) => boolean
}

function getCellValue<T>(row: T, key: string) {
  return (row as Record<string, unknown>)[key]
}

function RowActions<T>({
  row,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  row: T
  onEdit: (row: T) => void
  onDelete: (row: T) => void
  canEdit?: (row: T) => boolean
  canDelete?: (row: T) => boolean
}) {
  const editable = canEdit ? canEdit(row) : true
  const deletable = canDelete ? canDelete(row) : true

  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger
        type="button"
        aria-label="Actions"
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#666666] hover:bg-[#F5F5F5] hover:text-[#171717]"
      >
        <EllipsisVertical className="size-4" />
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-36 rounded-md border border-[#E5E5E6] bg-white p-1 shadow-sm"
        >
          <DropdownMenuPrimitive.Item
            disabled={!editable}
            title={editable ? undefined : 'System values cannot be edited'}
            onSelect={() => onEdit(row)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#171717] outline-none hover:bg-[#F5F5F5] data-disabled:pointer-events-none data-disabled:opacity-40"
          >
            <Pencil className="size-4 text-[#666666]" />
            Edit
          </DropdownMenuPrimitive.Item>
          <DropdownMenuPrimitive.Item
            disabled={!deletable}
            title={deletable ? undefined : 'System values cannot be deleted'}
            onSelect={() => onDelete(row)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10 data-disabled:pointer-events-none data-disabled:opacity-40"
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuPrimitive.Item>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}

export function PageContent<T>({
  title,
  description,
  searchPlaceholder = 'Search',
  searchValue,
  onSearchChange,
  filters,
  addLabel,
  onAdd,
  columns,
  rows,
  isLoading = false,
  getRowId,
  sortKey,
  sortDir,
  onSort,
  page,
  pageSize,
  total,
  onPageChange,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: PageContentProps<T>) {
  const [draftSearch, setDraftSearch] = useState(searchValue)

  useEffect(() => {
    setDraftSearch(searchValue)
  }, [searchValue])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draftSearch !== searchValue) {
        onSearchChange(draftSearch)
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [draftSearch, onSearchChange, searchValue])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div>
      <PageHeader title={title} description={description} />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="w-full min-w-48 flex-1 sm:max-w-xs">
          <IconInput
            icon={<Search />}
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search"
          />
        </div>
        {filters}
        <Button type="button" className="ml-auto cursor-pointer" onClick={onAdd}>
          <Plus className="size-4" />
          {addLabel}
        </Button>
      </div>

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-[#FAFAFA]">
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.sortable ? (
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-[#171717]"
                      onClick={() => onSort(column.key)}
                    >
                      {column.header}
                      {sortKey === column.key ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 text-[#A3A3A3]" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
              <TableHead className="w-16 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="py-10 text-center text-[#666666]">
                  Loading records...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="py-10 text-center text-[#666666]">
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={getRowId(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.render ? column.render(row) : String(getCellValue(row, column.key) ?? '')}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <RowActions
                      row={row}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#666666]">
        <p>
          Showing {from}–{to} of {total}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-3.5" />
            Prev
          </Button>
          <span className="px-2 text-[#171717]">
            {page} / {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
          >
            Next
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
