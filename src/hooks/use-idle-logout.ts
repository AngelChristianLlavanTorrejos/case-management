import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { toast } from '@/hooks/use-toast.tsx'
import { logoutUser } from '@/lib/auth-api'
import type { SecuritySettings } from '@/lib/security-settings-api'
import { useAuthStore } from '@/stores/auth-store'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const

export function useIdleLogout(settings: SecuritySettings | undefined) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const setSession = useAuthStore((state) => state.setSession)
  const timerRef = useRef<number | null>(null)
  const signingOutRef = useRef(false)

  const enabled = Boolean(settings?.is_logout_after_a_certain_idle_minutes)
  const minutes = settings?.max_idle_minutes ?? 0
  const userId = session?.id

  useEffect(() => {
    function clearTimer() {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    async function signOut() {
      if (signingOutRef.current || !userId) return
      signingOutRef.current = true
      try {
        await logoutUser(userId)
      } catch {
        // Still end the local session.
      } finally {
        setSession(null)
        queryClient.clear()
        toast.error(`You were signed out after ${minutes} minutes of inactivity.`)
        navigate('/login', { replace: true })
      }
    }

    function resetTimer() {
      clearTimer()
      timerRef.current = window.setTimeout(() => {
        void signOut()
      }, minutes * 60 * 1000)
    }

    if (!enabled || minutes < 1 || !userId) {
      clearTimer()
      return
    }

    resetTimer()
    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }))

    return () => {
      clearTimer()
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, resetTimer))
    }
  }, [enabled, minutes, userId, navigate, queryClient, setSession])
}
