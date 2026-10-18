import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { sessionStore } from '@/lib/session'

export const Route = createFileRoute('/_auth')({
  // roda ANTES de carregar a página: sem sessão, vai para o login lembrando o destino
  beforeLoad: ({ location }) => {
    if (!sessionStore.get()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: Outlet,
})