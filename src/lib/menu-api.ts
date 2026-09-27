import { supabase } from '@/lib/supabase'
import type { MenuNode, MenuRow } from '@/types/menu'

function menuId(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const id = Number(value)
  return Number.isFinite(id) ? id : null
}

function sortMenuNodes(nodes: MenuNode[]): MenuNode[] {
  return nodes
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
}

function nestPathPrefix(nodes: MenuNode[], folderName: string, prefix: string): MenuNode[] {
  const folder = nodes.find((node) => node.name === folderName)
  if (!folder) return nodes

  const orphans = nodes.filter((node) => node !== folder && node.path?.startsWith(prefix))
  if (orphans.length === 0) return nodes

  return nodes
    .filter((node) => node === folder || !node.path?.startsWith(prefix))
    .map((node) =>
      node === folder
        ? { ...node, children: sortMenuNodes([...node.children, ...orphans]) }
        : node,
    )
}

export function buildMenuTree(rows: MenuRow[]): MenuNode[] {
  const normalized = rows.map((row) => ({
    ...row,
    id: menuId(row.id) ?? row.id,
    parent_id: menuId(row.parent_id),
  }))
  const ids = new Set(normalized.map((row) => row.id))

  const byParent = new Map<number | null, MenuRow[]>()

  for (const row of normalized) {
    const key = row.parent_id != null && ids.has(row.parent_id) ? row.parent_id : null
    const siblings = byParent.get(key) ?? []
    siblings.push(row)
    byParent.set(key, siblings)
  }

  function branch(parentId: number | null): MenuNode[] {
    return sortMenuNodes(
      (byParent.get(parentId) ?? []).map((row) => ({ ...row, children: branch(row.id) })),
    )
  }

  return nestPathPrefix(branch(null), 'Masterfile', '/masterfile/')
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

export function filterMenuTree(nodes: MenuNode[], query: string): MenuNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes

  function visit(node: MenuNode): MenuNode | null {
    const nameMatch = node.name.toLowerCase().includes(q)
    const matchedChildren = node.children
      .map(visit)
      .filter((child): child is MenuNode => child != null)

    if (nameMatch) return node
    if (matchedChildren.length > 0) return { ...node, children: matchedChildren }
    return null
  }

  return nodes.map(visit).filter((node): node is MenuNode => node != null)
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
