import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { AppBreadcrumb } from '@/components/layout/app-breadcrumb'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'

export function AppLayout() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggleCollapsed = useUiStore((state) => state.toggleSidebarCollapsed)

  return (
    <div className="relative flex h-svh overflow-hidden bg-white">
      <div className={cn('relative z-20 h-full shrink-0 overflow-visible', collapsed ? 'w-16' : 'w-64')}>
        <AppSidebar />
      </div>

      <button
        type="button"
        className={cn(
          'absolute top-1/2 z-50 flex size-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-sidebar-border bg-white text-[#666666] shadow-sm hover:text-[#171717]',
          collapsed ? 'left-16' : 'left-64',
        )}
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
      </button>

      <main className="relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto bg-white p-4 sm:p-6">
        <AppBreadcrumb />
        <Outlet />
      </main>
    </div>
  )
}
