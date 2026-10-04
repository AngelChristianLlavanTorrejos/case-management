import { create } from 'zustand'

type LoadingState = {
  pending: number
  begin: () => void
  end: () => void
}

export const useLoadingStore = create<LoadingState>((set) => ({
  pending: 0,
  begin: () => set((state) => ({ pending: state.pending + 1 })),
  end: () => set((state) => ({ pending: Math.max(0, state.pending - 1) })),
}))

export function selectIsLoading(state: LoadingState) {
  return state.pending > 0
}
