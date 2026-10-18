import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { nftsQuery, type NftListParams } from '@/api/nfts'
import { Button } from '@/components/ui/button'
import { CatalogFilters } from '@/components/CatalogFilters'
import { CatalogSkeleton } from '@/components/CatalogSkeleton'
import { NftCard } from '@/components/NftCard'
import { Pagination } from '@/components/Pagination'

// Tudo que está na URL é validado aqui. Valor inválido vira "undefined" em vez de quebrar a tela.
const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  collection: z.string().optional().catch(undefined),
  minPrice: z.string().regex(/^\d+(\.\d+)?$/).optional().catch(undefined),
  maxPrice: z.string().regex(/^\d+(\.\d+)?$/).optional().catch(undefined),
  sort: z.enum(['recent', 'price_asc', 'price_desc', 'name']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/')({
  validateSearch: (search) => searchSchema.parse(search),
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const params: NftListParams = {
    q: search.q,
    collection: search.collection,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    sort: search.sort ?? 'recent',
    page: search.page ?? 1,
  }

  const { data, isPending, isError, isFetching, refetch } = useQuery(nftsQuery(params))

  // qualquer mudança de filtro volta para a página 1 (page: undefined remove da URL)
  const setFilter = (patch: Partial<Omit<NftListParams, 'page'>>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }) })

  const setPage = (page: number) =>
    navigate({ search: (prev) => ({ ...prev, page }) })

  const clearFilters = () => navigate({ search: {} })

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <h1 className="text-3xl font-bold">NFT Marketplace</h1>

      <section aria-label="Filtros" className="mt-6">
        <CatalogFilters
          values={{
            q: params.q,
            collection: params.collection,
            minPrice: params.minPrice,
            maxPrice: params.maxPrice,
            sort: params.sort,
          }}
          onChange={setFilter}
          onClear={clearFilters}
        />
      </section>

      <section aria-label="Catálogo" aria-busy={isFetching} className="mt-8">
        {isPending && <CatalogSkeleton />}

        {isError && (
          <div role="alert" className="rounded-lg border p-6">
            <p className="font-semibold">Não foi possível carregar o catálogo.</p>
            <Button className="mt-3" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="rounded-lg border p-6">
            <p>Nenhum NFT encontrado para esses filtros.</p>
            <Button className="mt-3" variant="outline" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        )}

        {data && data.items.length > 0 && (
          <>
            <p className="mb-4 text-sm">{data.total} NFTs encontrados</p>
            <ul
              className={`grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 ${
                isFetching ? 'opacity-60' : ''
              }`}
            >
              {data.items.map((nft) => (
                <NftCard key={nft.id} nft={nft} />
              ))}
            </ul>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </>
        )}
      </section>
    </div>
  )
}