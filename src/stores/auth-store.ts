import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { AuthSession } from '@/types/auth'

type AuthState = {
  session: AuthSession | null
  setSession: (session: AuthSession | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
    }),
    {
      name: 'cms-auth',
      partialize: (state) => ({ session: state.session }),
    },
  ),
)
