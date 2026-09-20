import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import { MenuIcon } from '@/components/layout/menu-icon'
import { cn } from '@/lib/utils'
import type { MenuNode } from '@/types/menu'

function pathIsActive(pathname: string, path: string | null) {
  if (!path) return false
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

function hasActiveChild(pathname: string, node: MenuNode): boolean {
  return node.children.some(
    (child) => pathIsActive(pathname, child.path) || hasActiveChild(pathname, child),
  )
}

export function SidebarNav({
  items,
  collapsed,
  onNavigate,
}: {
  items: MenuNode[]
  collapsed: boolean
  onNavigate?: () => void
}) {
  return (
    <nav className="grid gap-0.5 px-2" aria-label="Main">
      {items.map((item) => (
        <SidebarNavItem
          key={item.id}
          item={item}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  )
}

function SidebarNavItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: MenuNode
  collapsed: boolean
  onNavigate?: () => void
}) {
  const { pathname } = useLocation()
  const childActive = hasActiveChild(pathname, item)
  const [open, setOpen] = useState(childActive)
  const isParent = item.children.length > 0

  useEffect(() => {
    if (childActive) {
      setOpen(true)
    }
  }, [childActive])

  if (isParent && !item.path) {
    return (
      <div>
        <button
          type="button"
          title={collapsed ? item.name : undefined}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-sm text-sidebar-foreground hover:bg-sidebar-accent',
            collapsed && 'justify-center px-0',
            childActive && 'text-[#171717]',
          )}
        >
          <MenuIcon name={item.icon} className="size-4 shrink-0" />
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <ChevronDown
                className={cn('size-3.5 shrink-0 text-[#666666] transition-transform', open && 'rotate-180')}
              />
            </>
          ) : null}
        </button>
        {open && !collapsed ? (
          <div className="ml-4">
            {item.children.map((child, index) => {
              const isLast = index === item.children.length - 1

              return (
                <div key={child.id} className="relative pl-4">
                  <span
                    className={cn(
                      'absolute top-0 left-0 w-px bg-[#D4D4D4]',
                      isLast ? 'h-[18px]' : 'h-full',
                    )}
                    aria-hidden
                  />
                  <span
                    className="absolute top-[18px] left-0 h-px w-3 bg-[#D4D4D4]"
                    aria-hidden
                  />
                  <SidebarNavItem
                    item={child}
                    collapsed={false}
                    onNavigate={onNavigate}
                  />
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    )
  }

  if (!item.path) {
    return null
  }

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      title={collapsed ? item.name : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-sidebar-accent',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary'
            : 'text-sidebar-foreground',
        )
      }
    >
      <MenuIcon name={item.icon} className="size-4 shrink-0" />
      {!collapsed ? <span className="truncate">{item.name}</span> : null}
    </NavLink>
  )
}
