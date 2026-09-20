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
          <DialogHeader>
            <DialogTitle>{options.title}</DialogTitle>
            <DialogDescription>{options.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => resolve(false)}>
              {options.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              type="button"
              variant={options.variant === 'destructive' ? 'destructive' : 'default'}
              className="cursor-pointer"
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
