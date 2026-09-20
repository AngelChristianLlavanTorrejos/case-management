import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type AuthShellProps = {
  children: ReactNode
  cardClassName?: string
}

export function AuthShell({ children, cardClassName }: AuthShellProps) {
  return (
    <div className="relative min-h-svh">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/bg.png)` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-[#171717]/50" aria-hidden />
      <div className="relative z-10 flex min-h-svh items-center justify-center p-4 sm:p-6">
        <div
          className={cn(
            'w-full rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-lg sm:p-8',
            cardClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export function AuthBrand({ description }: { description: string }) {
  return (
    <div className="mb-6 text-center">
      <img
        src={`${import.meta.env.BASE_URL}images/logo.png`}
        alt="Barangay Tanza 1, Navotas"
        className="mx-auto mb-4 h-20 w-20 object-contain sm:h-24 sm:w-24"
      />
      <h1 className="text-xl font-semibold sm:text-2xl">Case Management System</h1>
      <p className="mt-1 text-sm text-[#666666]">{description}</p>
    </div>
  )
}
