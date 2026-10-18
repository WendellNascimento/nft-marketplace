import { Link, useNavigate } from '@tanstack/react-router'
import { useCart } from '@/api/cart'
import { Button } from '@/components/ui/button'
import { logout } from '@/lib/auth'
import { useRealtime } from '@/lib/realtime' // NOVO
import { useSession } from '@/lib/useSession'

const linkClass =
  'rounded-md px-2 py-1 text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

export function Header() {
  const session = useSession()
  const navigate = useNavigate()
  const { data: cart } = useCart()
  useRealtime() // NOVO: o Header existe em todas as telas, então a conexão fica aqui

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  const onLogout = async () => {
    await logout()
    navigate({ to: '/' })
  }

  return (
    <header className="border-b">
      <nav aria-label="Principal" className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 p-4">
        <Link to="/" className="mr-auto text-lg font-bold">
          NFT Marketplace
        </Link>
        <Link to="/" className={linkClass}>
          Catálogo
        </Link>
        <Link to="/cart" className={linkClass} aria-label={`Carrinho, ${itemCount} item(ns)`}>
          Carrinho ({itemCount})
        </Link>
        {session ? (
          <>
            <Link to="/profile" className={linkClass}>
              Perfil
            </Link>
            <Link to="/wallets" className={linkClass}>
              Carteiras
            </Link>
            <span className="text-sm">Olá, {session.user.name}</span>
            <Button variant="outline" size="sm" onClick={onLogout}>
              Sair
            </Button>
          </>
        ) : (
          <>
            <Link to="/login" className={linkClass}>
              Entrar
            </Link>
            <Link to="/register" className={linkClass}>
              Criar conta
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}