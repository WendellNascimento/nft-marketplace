import { Link } from '@tanstack/react-router'
import { FavoriteButton } from '@/components/FavoriteButton'
import { Badge } from '@/components/ui/badge'
import { formatEth } from '@/lib/money'
import type { Nft } from '@/types/api'

export function NftCard({ nft }: { nft: Nft }) {
  return (
    <li className="relative">
      <Link
        to="/nft/$nftId"
        params={{ nftId: nft.id }}
        className="block rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <img
          src={nft.images[0]}
          alt={nft.name}
          width={600}
          height={600}
          className="aspect-square w-full rounded-lg"
        />
        <p className="mt-3 h-6 truncate font-semibold">{nft.name}</p>
        <p className="mt-1 flex h-5 items-center gap-2 text-sm">
          {formatEth(nft.price)}
          {nft.available === 0 && <Badge variant="secondary">Esgotado</Badge>}
        </p>
      </Link>
      <FavoriteButton
        nftId={nft.id}
        nftName={nft.name}
        className="absolute top-2 right-2"
      />
    </li>
  )
}