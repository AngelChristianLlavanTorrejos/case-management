import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Search, User, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { SidebarNav } from '@/components/layout/sidebar-nav'
import { IconInput } from '@/components/ui/icon-input'
import { logoutUser, getUserProfile } from '@/lib/auth-api'
import { filterMenuTree, getActiveMenus } from '@/lib/menu-api'
import { canAccessDashboard, isSuperAdmin } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import type { MenuNode } from '@/types/menu'

function menusForRole(nodes: MenuNode[], roleName: string | null | undefined): MenuNode[] {
  return nodes.flatMap((item) => {
    if (!canAccessDashboard(roleName) && (item.name === 'Dashboard' || item.path === '/')) return []
    if (!isSuperAdmin(roleName) && isSuperAdminModule(item)) return []
    if (!canAccessDashboard(roleName) && item.path === '/summon-for-the-respondent') return []
    return [{ ...item, children: menusForRole(item.children, roleName) }]
  })
}

function isSuperAdminModule(item: MenuNode) {
  const path = item.path ?? ''
  return (
    item.name === 'Masterfile' ||
    path.startsWith('/masterfile') ||
    item.name === 'Community Members' ||
    path.startsWith('/community-members') ||
    item.name === 'Lupon Members' ||
    path.startsWith('/lupon-members') ||
    item.name === 'Technical Support' ||
    path.startsWith('/technical-support') ||
    item.name === 'Utilities' ||
    path === '/user-activity-log' ||
    path === '/baseline-security'
  )
}

export function AppSidebar({ className }: { className?: string }) {
  const session = useAuthStore((state) => state.session)
  const setSession = useAuthStore((state) => state.setSession)
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [menuQuery, setMenuQuery] = useState('')

  const menus = useQuery({
    queryKey: ['active-menus'],
    queryFn: getActiveMenus,
  })

  const profile = useQuery({
    queryKey: ['user-profile', session?.id],
    queryFn: () => getUserProfile(session!.id),
    enabled: Boolean(session?.id),
  })

  const displayName = profile.data?.displayName ?? session?.displayName ?? session?.username
  const roleName = profile.data?.roleName ?? session?.roleName

  const visibleMenus = useMemo(
    () => filterMenuTree(menusForRole(menus.data ?? [], roleName), menuQuery),
    [menus.data, menuQuery, roleName],
  )

  async function handleLogout() {
    if (isLoggingOut) return

    setIsLoggingOut(true)

    try {
      if (session?.id) {
        await logoutUser(session.id)
      }
    } catch {
      // Still end the local session so the user can leave the app.
    } finally {
      setSession(null)
      queryClient.clear()
      navigate('/login', { replace: true })
    }
  }

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        collapsed ? 'w-16' : 'w-64',
        className,
      )}
    >
      <div
        className={cn(
          'flex border-b border-sidebar-border',
          collapsed ? 'justify-center px-2 py-3' : 'items-center gap-3 px-3 py-3',
        )}
      >
        <div className={cn('flex min-w-0 items-center gap-3', collapsed && 'justify-center')}>
          <img
            src={`${import.meta.env.BASE_URL}images/logo.png`}
            alt=""
            className={cn('shrink-0 object-contain', collapsed ? 'size-9' : 'size-11')}
          />
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-base leading-tight font-semibold text-[#171717]">
                Tanza Resolve
              </p>
              <p className="mt-0.5 truncate text-sm text-[#666666]">Case Management System</p>
            </div>
          ) : null}
        </div>
      </div>

      {!collapsed ? (
        <div className="px-2 pt-3 pb-1">
          <div className="relative">
            <IconInput
              icon={<Search />}
              value={menuQuery}
              onChange={(event) => setMenuQuery(event.target.value)}
              placeholder="Search menu"
              aria-label="Search menu"
              className="h-8 bg-[#F7F7F8] pr-8"
            />
            {menuQuery ? (
              <button
                type="button"
                className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-[#666666] hover:bg-[#E8E8EA] hover:text-[#171717]"
                onClick={() => setMenuQuery('')}
                aria-label="Clear menu search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="scrollbar-hidden min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-3">
        {menus.isError ? (
          <p className="px-3 text-xs text-destructive">
            {menus.error instanceof Error ? menus.error.message : 'Unable to load menus.'}
          </p>
        ) : visibleMenus.length === 0 && menuQuery.trim() ? (
          <p className="px-3 text-xs text-[#666666]">No menus found.</p>
        ) : (
          <SidebarNav
            items={visibleMenus}
            collapsed={collapsed}
            expandAll={Boolean(menuQuery.trim())}
          />
        )}
      </div>

      <div className={cn('border-t border-sidebar-border', collapsed ? 'px-2 py-3' : 'px-3 py-3')}>
        <div className={cn('flex items-center gap-2', collapsed && 'flex-col')}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E8E8EA] text-[#666666]">
            <User className="size-4" />
          </span>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm leading-tight font-medium text-[#171717]">
                {displayName}
              </p>
              <p className="mt-0.5 truncate text-xs text-[#666666]">{roleName}</p>
            </div>
          ) : null}
          <div className="relative">
            <button
              type="button"
              className="peer flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#666666] hover:bg-[#F5F5F5] hover:text-[#171717] disabled:opacity-50"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Log out"
            >
              <LogOut className="size-4 -scale-x-100" />
            </button>
            <span
              role="tooltip"
              className={cn(
                'pointer-events-none absolute z-50 w-max whitespace-nowrap rounded-md border border-[#E5E5E6] bg-white px-2.5 py-1.5 text-xs font-medium text-[#171717] shadow-sm',
                'opacity-0 transition-opacity duration-150 peer-hover:opacity-100 peer-focus-visible:opacity-100',
                collapsed
                  ? 'top-1/2 left-full ml-2 -translate-y-1/2'
                  : 'bottom-full left-1/2 mb-2 -translate-x-1/2',
              )}
            >
              Log out
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
