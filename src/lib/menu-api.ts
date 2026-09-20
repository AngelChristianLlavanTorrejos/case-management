import { supabase } from '@/lib/supabase'
import type { MenuNode, MenuRow } from '@/types/menu'

export function buildMenuTree(rows: MenuRow[]): MenuNode[] {
  const byParent = new Map<number | null, MenuRow[]>()

  for (const row of rows) {
    const key = row.parent_id
    const siblings = byParent.get(key) ?? []
    siblings.push(row)
    byParent.set(key, siblings)
  }

  function branch(parentId: number | null): MenuNode[] {
    return (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((row) => ({ ...row, children: branch(row.id) }))
  }

  return branch(null)
}

export async function getActiveMenus(): Promise<MenuNode[]> {
  const { data, error } = await supabase
    .from('menus')
    .select('id, parent_id, name, icon, path, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    throw new Error(error.message)
  }

  return buildMenuTree((data ?? []) as MenuRow[])
}

function pathMatches(pathname: string, path: string) {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function findMenuTrail(nodes: MenuNode[], pathname: string): MenuNode[] {
  function walk(items: MenuNode[], ancestors: MenuNode[]): MenuNode[] | null {
    for (const item of items) {
      const trail = [...ancestors, item]
      const nested = walk(item.children, trail)
      if (nested) return nested
      if (item.path && pathMatches(pathname, item.path)) return trail
    }
    return null
  }

  return walk(nodes, []) ?? []
}
