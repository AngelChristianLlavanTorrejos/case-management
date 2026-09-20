import { Check, CircleAlert, X } from 'lucide-react'
import { create } from 'zustand'

type ToastVariant = 'success' | 'error'

type ToastItem = {
  id: number
  title: string
  description?: string
  variant: ToastVariant
}

type ToastStore = {
  toasts: ToastItem[]
  show: (toast: Omit<ToastItem, 'id'>) => void
  dismiss: (id: number) => void
}

let toastId = 0

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (toast) => {
    const id = ++toastId
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }))
    }, 3500)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
}))

export const toast = {
  success(title: string, description?: string) {
    useToastStore.getState().show({ title, description, variant: 'success' })
  },
  error(title: string, description?: string) {
    useToastStore.getState().show({ title, description, variant: 'error' })
  },
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[70] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto flex gap-3 rounded-lg border border-[#E5E5E6] bg-white px-3 py-3 shadow-md"
        >
          <span className="mt-0.5 shrink-0">
            {item.variant === 'success' ? (
              <Check className="size-4 text-brand" />
            ) : (
              <CircleAlert className="size-4 text-destructive" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#171717]">{item.title}</p>
            {item.description ? <p className="mt-0.5 text-xs text-[#666666]">{item.description}</p> : null}
          </div>
          <button
            type="button"
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#666666] hover:bg-[#F5F5F5] hover:text-[#171717]"
            onClick={() => dismiss(item.id)}
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
