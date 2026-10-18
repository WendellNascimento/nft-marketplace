import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { api } from '@/api/client'
import { Header } from '@/components/Header'
import { useSession } from '@/lib/useSession'

export const Route = createRootRoute({
  component: Root,
})

function Root() {
  const session = useSession()

  // confere se o token ainda vale (401 aqui dispara o tratamento de sessão expirada)
  useQuery({
    queryKey: ['session', session?.user.id],
    queryFn: async () => (await api.get('/session')).data,
    enabled: !!session,
    staleTime: 5 * 60_000,
    retry: false,
  })

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:p-2"
      >
        Pular para o conteúdo
      </a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Toaster />
    </>
  )
}