import { Heart } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { useFavorites, useToggleFavorite } from '@/api/favorites'
import { useSession } from '@/lib/useSession'

interface Props {
  nftId: string
  nftName: string
  className?: string
}

export function FavoriteButton({ nftId, nftName, className = '' }: Props) {
  const session = useSession()
  const router = useRouter()
  const { data: favorites } = useFavorites()
  const toggle = useToggleFavorite()

  const isFavorite = !!favorites?.includes(nftId)

  const onClick = () => {
    // visitante: vai para o login e volta para esta mesma página depois
    if (!session) {
      router.navigate({
        to: '/login',
        search: { redirect: router.state.location.href },
      })
      return
    }
    toggle.mutate({ nftId, favorite: !isFavorite })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isFavorite}
      aria-label={
        isFavorite
          ? `Remover ${nftName} dos favoritos`
          : `Adicionar ${nftName} aos favoritos`
      }
      className={`flex size-10 items-center justify-center rounded-full bg-background/90 shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${className}`}
    >
      <Heart
        aria-hidden="true"
        className={`size-5 ${isFavorite ? 'fill-red-600 text-red-600' : ''}`}
      />
    </button>
  )
}