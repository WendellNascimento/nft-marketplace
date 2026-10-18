import { Link, useNavigate } from '@tanstack/react-router'
import { useCart } from '@/api/cart'
import { Button } from '@/components/ui/button'
import { logout } from '@/lib/auth'
import { useRealtime } from '@/lib/realtime'
import { useSession } from '@/lib/useSession'

// Estilo comum dos links do menu
const linkClass =
  'rounded-md px-2 py-1 text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

// Link da página atual fica em cobre (como no Figma)
const activeProps = { className: 'text-primary underline' }

export function Header() {
  const session = useSession()
  const navigate = useNavigate()
  const { data: cart } = useCart()
  useRealtime() // O Header existe em todas as telas, então a conexão fica aqui

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  const onLogout = async () => {
    await logout()
    navigate({ to: '/' })
  }

  return (
    <header className="border-b">
      {/* Em telas médias: 3 colunas (marca | menu centralizado | ações) */}
      <nav
        aria-label="Principal"
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 md:grid md:grid-cols-[1fr_auto_1fr]"
      >
        <Link to="/" className="text-sm font-bold tracking-widest">
          KURIO
        </Link>

        <div className="flex items-center gap-2">
          <Link to="/" activeOptions={{ exact: true }} activeProps={activeProps} className={linkClass}>
            Catálogo
          </Link>
          <Link
            to="/cart"
            activeProps={activeProps}
            className={linkClass}
            aria-label={`Carrinho, ${itemCount} item(ns)`}
          >
            Carrinho ({itemCount})
          </Link>
          {session && (
            <>
              <Link to="/profile" activeProps={activeProps} className={linkClass}>
                Perfil
              </Link>
              <Link to="/wallets" activeProps={activeProps} className={linkClass}>
                Carteiras
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          {session ? (
            <>
              <span className="text-sm">Olá, {session.user.name}</span>
              <Button size="sm" onClick={onLogout}>
                Sair
              </Button>
            </>
          ) : (
            <>
              <Link to="/register" className={linkClass}>
                Criar conta
              </Link>
              <Link
                to="/login"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Entrar
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

