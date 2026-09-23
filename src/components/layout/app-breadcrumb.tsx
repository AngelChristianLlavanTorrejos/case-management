import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'

import { findMenuTrail, getActiveMenus } from '@/lib/menu-api'

function extraCrumbLabel(pathname: string, menuPath: string | null | undefined) {
  if (!menuPath || menuPath === '/') return null
  if (pathname === menuPath || !pathname.startsWith(`${menuPath}/`)) return null

  const rest = pathname.slice(menuPath.length + 1)
  if (rest === 'add') return 'Add'
  if (/^\d+\/edit$/.test(rest)) return 'Edit'
  if (/^\d+\/view$/.test(rest)) return 'View'
  return null
}

export function AppBreadcrumb() {
  const { pathname } = useLocation()
  const menus = useQuery({
    queryKey: ['active-menus'],
    queryFn: getActiveMenus,
  })

  const trail = findMenuTrail(menus.data ?? [], pathname)
  const belongsToParentMenu = trail.some((item) => item.children.length > 0)
  const extra = extraCrumbLabel(pathname, trail.at(-1)?.path)

  if (trail.length === 0 || (!belongsToParentMenu && !extra)) {
    return null
  }

  const crumbs = [
    ...trail.map((item) => ({
      key: String(item.id),
      label: item.name,
      path: item.path,
    })),
    ...(extra ? [{ key: 'extra', label: extra, path: null as string | null }] : []),
  ]

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-[#666666]">
        {crumbs.map((item, index) => {
          const isLast = index === crumbs.length - 1

          return (
            <li key={item.key} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true">&gt;</span> : null}
              {item.path && !isLast ? (
                <Link to={item.path} className="hover:text-brand hover:underline">
                  {item.label}
                </Link>
              ) : item.path && isLast ? (
                <Link
                  to={item.path}
                  className="font-medium text-[#171717]"
                  aria-current="page"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'font-medium text-[#171717]' : undefined} aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
