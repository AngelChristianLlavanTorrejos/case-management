import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { useLoadingStore } from '@/stores/loading-store'

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
  return method.toUpperCase()
}

/** True for mutating requests only. Reads (GET / list_* / get_* RPCs) skip the global loader. */
function shouldShowGlobalLoader(input: RequestInfo | URL, init?: RequestInit) {
  const method = requestMethod(input, init)
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false

  const url = requestUrl(input)

  // Edge function invokes are actions (SMS, AI, OTP).
  if (url.includes('/functions/v1/')) return true

  const rpcMatch = /\/rpc\/([^/?#]+)/i.exec(url)
  if (rpcMatch) {
    const name = decodeURIComponent(rpcMatch[1]).toLowerCase()
    if (
      name.startsWith('list_') ||
      name.startsWith('get_') ||
      name.startsWith('validate_')
    ) {
      return false
    }
    return true
  }

  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
}

export function createClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
  }

  return createSupabaseClient(supabaseUrl, supabasePublishableKey, {
    global: {
      fetch: async (input, init) => {
        const track = shouldShowGlobalLoader(input, init)
        if (track) useLoadingStore.getState().begin()
        try {
          return await fetch(input, init)
        } finally {
          if (track) useLoadingStore.getState().end()
        }
      },
    },
  })
}
