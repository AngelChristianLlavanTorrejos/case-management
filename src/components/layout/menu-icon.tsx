import {
  Circle,
  FolderTree,
  HeartHandshake,
  LayoutDashboard,
  Tags,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderTree,
  Tags,
  HeartHandshake,
}

export function MenuIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Circle
  return <Icon className={className} />
}
