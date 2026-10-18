import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { COLLECTIONS } from '@/lib/constants'
import type { NftListParams } from '@/api/nfts'

type Values = Omit<NftListParams, 'page'>

interface Props {
  values: Values
  onChange: (patch: Partial<Values>) => void
  onClear: () => void
}

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

const PRICE = /^\d+(\.\d+)?$/

export function CatalogFilters({ values, onChange, onClear }: Props) {
  // texto da busca: estado local + debounce, para não criar uma requisição por tecla
  const [text, setText] = useState(values.q ?? '')
  const [priceError, setPriceError] = useState('')

  // botão "voltar" do navegador muda a URL: sincroniza o campo
  useEffect(() => {
    setText(values.q ?? '')
  }, [values.q])

  useEffect(() => {
    if (text === (values.q ?? '')) return
    const timer = setTimeout(() => onChange({ q: text || undefined }), 300)
    return () => clearTimeout(timer)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  const onPriceSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const min = String(data.get('min') ?? '').trim()
    const max = String(data.get('max') ?? '').trim()
    if ((min && !PRICE.test(min)) || (max && !PRICE.test(max))) {
      setPriceError('Use números como 0.05 (com ponto).')
      return
    }
    setPriceError('')
    onChange({ minPrice: min || undefined, maxPrice: max || undefined })
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div>
        <Label htmlFor="search">Buscar</Label>
        <Input
          id="search"
          type="search"
          placeholder="Nome ou coleção"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="collection">Coleção</Label>
        <select
          id="collection"
          className={selectClass}
          value={values.collection ?? ''}
          onChange={(e) => onChange({ collection: e.target.value || undefined })}
        >
          <option value="">Todas</option>
          {COLLECTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="sort">Ordenar por</Label>
        <select
          id="sort"
          className={selectClass}
          value={values.sort}
          onChange={(e) => onChange({ sort: e.target.value as Values['sort'] })}
        >
          <option value="recent">Mais recentes</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
          <option value="name">Nome (A–Z)</option>
        </select>
      </div>

      <form
        key={`${values.minPrice}-${values.maxPrice}`}
        onSubmit={onPriceSubmit}
        className="flex items-end gap-2"
      >
        <div>
          <Label htmlFor="min">Mín. (ETH)</Label>
          <Input id="min" name="min" inputMode="decimal" defaultValue={values.minPrice ?? ''} aria-invalid={!!priceError} />
        </div>
        <div>
          <Label htmlFor="max">Máx. (ETH)</Label>
          <Input id="max" name="max" inputMode="decimal" defaultValue={values.maxPrice ?? ''} aria-invalid={!!priceError} />
        </div>
        <Button type="submit">Aplicar</Button>
      </form>

      {priceError && (
        <p role="alert" className="text-sm text-red-600 md:col-span-4">
          {priceError}
        </p>
      )}

      <div className="md:col-span-4">
        <Button variant="ghost" onClick={onClear}>
          Limpar filtros
        </Button>
      </div>
    </div>
  )
}