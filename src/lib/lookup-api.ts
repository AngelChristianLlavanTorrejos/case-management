import { supabase } from '@/lib/supabase'

export type LookupRow = {
  id: number
  name: string
  can_delete: boolean
}

export type LookupKind = 'suffix' | 'civil_status'

export type LookupListQuery = {
  search: string
  type: 'all' | 'system' | 'custom'
  sortKey: 'name' | 'can_delete'
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number
}

export type LookupListResult = {
  rows: LookupRow[]
  total: number
}

const tables: Record<LookupKind, 'suffixes' | 'civil_status'> = {
  suffix: 'suffixes',
  civil_status: 'civil_status',
}

const createRpc: Record<LookupKind, string> = {
  suffix: 'create_suffix',
  civil_status: 'create_civil_status',
}

const updateRpc: Record<LookupKind, string> = {
  suffix: 'update_suffix',
  civil_status: 'update_civil_status',
}

const deleteRpc: Record<LookupKind, string> = {
  suffix: 'delete_suffix',
  civil_status: 'delete_civil_status',
}

function rpcError(message: string) {
  return new Error(message.replace(/^.*ERROR:\s*/i, ''))
}

export async function listLookups(kind: LookupKind, query: LookupListQuery): Promise<LookupListResult> {
  const from = (query.page - 1) * query.pageSize
  const to = from + query.pageSize - 1
  const search = query.search.trim()

  let request = supabase.from(tables[kind]).select('id, name, can_delete', { count: 'exact' })

  if (search) {
    request = request.ilike('name', `%${search}%`)
  }

  if (query.type === 'system') {
    request = request.eq('can_delete', false)
  } else if (query.type === 'custom') {
    request = request.eq('can_delete', true)
  }

  const { data, error, count } = await request
    .order(query.sortKey, { ascending: query.sortDir === 'asc' })
    .order('id', { ascending: true })
    .range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  return {
    rows: (data ?? []) as LookupRow[],
    total: count ?? 0,
  }
}

export async function createLookup(kind: LookupKind, name: string): Promise<void> {
  const { error } = await supabase.rpc(createRpc[kind], { p_name: name })
  if (error) throw rpcError(error.message)
}

export async function updateLookup(kind: LookupKind, id: number, name: string): Promise<void> {
  const { error } = await supabase.rpc(updateRpc[kind], { p_id: id, p_name: name })
  if (error) throw rpcError(error.message)
}

export async function deleteLookup(kind: LookupKind, id: number): Promise<void> {
  const { error } = await supabase.rpc(deleteRpc[kind], { p_id: id })
  if (error) throw rpcError(error.message)
}
