import type { Nft } from '@/types/api'

const collections = ['Neon Apes', 'Pixel Lands', 'Aether', 'Cyber Koi']

// imagem gerada em código (gradiente), usada no lugar dos assets do Figma
const svg = (seed: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${(seed * 47) % 360},70%,50%)"/><stop offset="1" stop-color="hsl(${(seed * 47 + 80) % 360},70%,30%)"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/></svg>`,
  )}`

export function buildSeedNfts(): Nft[] {
  return Array.from({ length: 48 }, (_, i) => {
    const n = i + 1
    const base = (0.05 + (n % 9) * 0.0375).toFixed(6)
    const editions = [
      {
        id: `${n}-std`,
        label: 'Padrão',
        price: base,
        available: n % 7 === 0 ? 0 : 5,
      },
      {
        id: `${n}-rare`,
        label: 'Rara',
        price: (Number(base) * 2).toFixed(6),
        available: n % 5 === 0 ? 0 : 2,
      },
    ]
    return {
      id: `nft-${n}`,
      name: `${collections[n % 4]} #${n}`,
      collection: collections[n % 4],
      creator: `creator-${(n % 6) + 1}`,
      description: `Descrição do NFT ${n}.`,
      images: [svg(n), svg(n + 100)],
      price: base,
      available: editions.reduce((sum, e) => sum + e.available, 0),
      editions,
      version: 1,
    }
  })
}