export type MenuRow = {
  id: number
  parent_id: number | null
  name: string
  icon: string
  path: string | null
  sort_order: number
  is_active: boolean
}

export type MenuNode = MenuRow & {
  children: MenuNode[]
}
