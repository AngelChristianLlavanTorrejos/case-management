import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, User } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { SidebarNav } from '@/components/layout/sidebar-nav'
import { logoutUser, getUserProfile } from '@/lib/auth-api'
import { getActiveMenus } from '@/lib/menu-api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'

export function AppSidebar({ className }: { className?: string }) {
  const session = useAuthStore((state) => state.session)
  const setSession = useAuthStore((state) => state.setSession)
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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
            src="/images/logo.png"
            alt=""
            className={cn('shrink-0 object-contain', collapsed ? 'size-9' : 'size-11')}
          />
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-base leading-tight font-semibold text-[#171717]">
                Case Management
              </p>
              <p className="mt-0.5 truncate text-sm text-[#666666]">System</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        {menus.isError ? (
          <p className="px-3 text-xs text-destructive">
            {menus.error instanceof Error ? menus.error.message : 'Unable to load menus.'}
          </p>
        ) : (
          <SidebarNav items={menus.data ?? []} collapsed={collapsed} />
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
