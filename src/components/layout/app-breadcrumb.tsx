import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'

import { findMenuTrail, getActiveMenus } from '@/lib/menu-api'

export function AppBreadcrumb() {
  const { pathname } = useLocation()
  const menus = useQuery({
    queryKey: ['active-menus'],
    queryFn: getActiveMenus,
  })

  const trail = findMenuTrail(menus.data ?? [], pathname)
  const belongsToParentMenu = trail.some((item) => item.children.length > 0)

  if (trail.length === 0 || !belongsToParentMenu) {
    return null
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-[#666666]">
        {trail.map((item, index) => {
          const isLast = index === trail.length - 1

          return (
            <li key={item.id} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true">&gt;</span> : null}
              {item.path ? (
                <Link
                  to={item.path}
                  className={
                    isLast
                      ? 'font-medium text-[#171717]'
                      : 'hover:text-brand hover:underline'
                  }
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.name}
                </Link>
              ) : (
                <span className={isLast ? 'font-medium text-[#171717]' : undefined}>
                  {item.name}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
