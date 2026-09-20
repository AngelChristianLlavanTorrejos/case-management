import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ConfirmProvider } from '@/hooks/use-confirm'
import { Toaster } from '@/hooks/use-toast.tsx'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <App />
        <Toaster />
      </ConfirmProvider>
    </QueryClientProvider>
  </StrictMode>,
)
