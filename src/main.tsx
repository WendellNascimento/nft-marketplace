import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { setUnauthorizedHandler } from '@/api/client'
import { endSession } from '@/lib/auth'
import { queryClient } from '@/lib/queryClient'
import './index.css'

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultNotFoundComponent: () => <p className="p-8">Página não encontrada.</p>,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// 401 com sessão ativa = sessão expirou: limpa tudo e volta ao login, lembrando onde o usuário estava
setUnauthorizedHandler(() => {
  endSession()
  router.navigate({
    to: '/login',
    search: { redirect: router.state.location.href, reason: 'expired' },
  })
})

async function bootstrap() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks() // espera o worker ficar pronto ANTES de mostrar a tela
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}

bootstrap()