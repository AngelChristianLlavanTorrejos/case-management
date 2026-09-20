import {
  Circle,
  FolderTree,
  HeartHandshake,
  House,
  LayoutDashboard,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  circle: Circle,
  foldertree: FolderTree,
  hearthandshake: HeartHandshake,
  house: House,
  home: House,
  layoutdashboard: LayoutDashboard,
  tags: Tags,
  users: Users,
  user: Users,
}

function iconKey(name: string) {
  return name.replace(/[-_\s]/g, '').toLowerCase()
}

export function MenuIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[iconKey(name)] ?? Circle
  return <Icon className={className} />
}
