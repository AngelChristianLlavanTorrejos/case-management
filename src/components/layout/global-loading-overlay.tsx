import { selectIsLoading, useLoadingStore } from '@/stores/loading-store'

export function GlobalLoadingOverlay() {
  const isLoading = useLoadingStore(selectIsLoading)
  if (!isLoading) return null

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-transparent"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div className="flex w-28 flex-col items-center gap-2 rounded-lg border border-[#E5E5E6] bg-white px-4 py-3 shadow-sm">
        <div
          className="size-5 animate-spin rounded-full border-2 border-brand/25 border-t-brand"
          aria-hidden="true"
        />
        <p className="text-xs text-[#171717]">Loading...</p>
      </div>
    </div>
  )
}
