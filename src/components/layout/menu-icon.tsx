import {
  Circle,
  CircleUser,
  FolderTree,
  HeartHandshake,
  House,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  circle: Circle,
  circleuser: CircleUser,
  foldertree: FolderTree,
  hearthandshake: HeartHandshake,
  house: House,
  home: House,
  keyround: KeyRound,
  layoutdashboard: LayoutDashboard,
  scrolltext: ScrollText,
  shieldcheck: ShieldCheck,
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
