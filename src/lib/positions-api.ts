import { supabase } from '@/lib/supabase'

export type PositionRow = {
  id: number
  name: string
  sort_order: number
}

export async function listPositions(): Promise<PositionRow[]> {
  const { data, error } = await supabase
    .from('positions')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as PositionRow[]
}

export async function listAvailableLuponPositions(
  excludeUserId?: number | null,
): Promise<PositionRow[]> {
  const { data, error } = await supabase.rpc('list_available_lupon_positions', {
    p_exclude_user_id: excludeUserId ?? null,
  })

  if (error) throw new Error(error.message.replace(/^.*ERROR:\s*/i, ''))

  const parsed = (typeof data === 'string' ? JSON.parse(data) : data) as PositionRow[] | null
  return parsed ?? []
}

export async function getLuponChairmanName(): Promise<string> {
  const { data, error } = await supabase.rpc('get_lupon_chairman_name')
  if (error) throw new Error(error.message.replace(/^.*ERROR:\s*/i, ''))
  return typeof data === 'string' ? data.trim() : ''
}
