import * as React from 'react'
import { cn } from 'cn'

import { Input } from '@/components/ui/input'

export const IconInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input> & { icon: React.ReactNode }
>(({ icon, className, ...props }, ref) => {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#666666] [&_svg]:size-4">
        {icon}
      </span>
      <Input ref={ref} className={cn('pl-8', className)} {...props} />
    </div>
  )
})

IconInput.displayName = 'IconInput'
