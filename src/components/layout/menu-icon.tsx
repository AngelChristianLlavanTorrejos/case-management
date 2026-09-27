import {
  BadgeCheck,
  Circle,
  CircleUser,
  FileText,
  FolderTree,
  Gavel,
  Headset,
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
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  badgecheck: BadgeCheck,
  circle: Circle,
  circleuser: CircleUser,
  filetext: FileText,
  foldertree: FolderTree,
  gavel: Gavel,
  headset: Headset,
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
  usercog: UserCog,
  users: Users,
  user: Users,
  wrench: Wrench,
}

function iconKey(name: string) {
  return name.replace(/[-_\s]/g, '').toLowerCase()
}

export function MenuIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[iconKey(name)] ?? Circle
  return <Icon className={className} />
}
