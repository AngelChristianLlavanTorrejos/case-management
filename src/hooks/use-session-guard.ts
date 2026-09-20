import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { toast } from '@/hooks/use-toast.tsx'
import { validateSession } from '@/lib/security-settings-api'
import { useAuthStore } from '@/stores/auth-store'

export function useSessionGuard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const setSession = useAuthStore((state) => state.setSession)
  const signingOutRef = useRef(false)

  const userId = session?.id
  const token = session?.sessionToken ?? null

  useEffect(() => {
    function endLocalSession(message: string) {
      if (signingOutRef.current) return
      signingOutRef.current = true
      setSession(null)
      queryClient.clear()
      toast.error(message)
      navigate('/login', { replace: true })
    }

    async function check() {
      if (!userId) return
      try {
        const valid = await validateSession(userId, token)
        if (!valid) {
          endLocalSession('You were signed out because your account signed in on another device.')
        }
      } catch {
        // Ignore transient network errors.
      }
    }

    if (!userId) return

    void check()
    const interval = window.setInterval(() => {
      void check()
    }, 15000)

    function onFocus() {
      void check()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [userId, token, navigate, queryClient, setSession])
}
