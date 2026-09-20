import { AlertTriangle, Save } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type ConfirmOptions = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    description: '',
  })
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const resolve = useCallback((value: boolean) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setOpen(false)
  }, [])

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next)
    setOpen(true)

    return new Promise<boolean>((resolvePromise) => {
      resolverRef.current = resolvePromise
    })
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])
  const isDanger = options.variant === 'destructive'

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) resolve(false)
        }}
      >
        <DialogContent className="z-[60]" overlayClassName="z-[60]">
          <DialogHeader className="mb-0">
            <div className="flex gap-3">
              <span
                className={cn(
                  'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full',
                  isDanger ? 'bg-[#F8EBE8] text-[#BA3C25]' : 'bg-[#EEF4EA] text-[#225008]',
                )}
              >
                {isDanger ? <AlertTriangle className="size-5" /> : <Save className="size-5" />}
              </span>
              <div className="min-w-0 pt-0.5">
                <DialogTitle>{options.title}</DialogTitle>
                <DialogDescription className="mt-1.5 leading-5">{options.description}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => resolve(false)}>
              {options.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              type="button"
              className={cn(
                'cursor-pointer text-white',
                isDanger
                  ? 'bg-[#BA3C25] hover:bg-[#9E3320]'
                  : 'bg-[#225008] hover:bg-[#1B4006]',
              )}
              onClick={() => resolve(true)}
            >
              {options.confirmLabel ?? 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)

  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider.')
  }

  return context.confirm
}
