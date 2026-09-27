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
