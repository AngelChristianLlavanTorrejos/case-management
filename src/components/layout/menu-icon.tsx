import {
  Circle,
  CircleUser,
  FileText,
  FolderTree,
  Gavel,
  HeartHandshake,
  House,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Scale,
  ScrollText,
  ShieldCheck,
  Stamp,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  circle: Circle,
  circleuser: CircleUser,
  filetext: FileText,
  foldertree: FolderTree,
  gavel: Gavel,
  hearthandshake: HeartHandshake,
  house: House,
  home: House,
  keyround: KeyRound,
  layoutdashboard: LayoutDashboard,
  megaphone: Megaphone,
  scale: Scale,
  scrolltext: ScrollText,
  shieldcheck: ShieldCheck,
  stamp: Stamp,
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
