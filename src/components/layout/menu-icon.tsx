import {
  Circle,
  FolderTree,
  HeartHandshake,
  LayoutDashboard,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderTree,
  Tags,
  HeartHandshake,
  Users,
}

export function MenuIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Circle
  return <Icon className={className} />
}
