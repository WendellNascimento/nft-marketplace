import axios from 'axios'
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api, isTransient } from './client'
import type { Nft, Paginated } from '@/types/api'

export interface NftListParams {
  q?: string
  collection?: string
  minPrice?: string
  maxPrice?: string
  sort: 'recent' | 'price_asc' | 'price_desc' | 'name'
  page: number
}

export const nftsQuery = (params: NftListParams) =>
  queryOptions({
    queryKey: ['nfts', params],
    queryFn: async ({ signal }) =>
      (await api.get<Paginated<Nft>>('/nfts', { params, signal })).data,
    placeholderData: keepPreviousData,
  })

export const nftQuery = (id: string) =>
  queryOptions({
    queryKey: ['nft', id],
    queryFn: async ({ signal }) =>
      (await api.get<Nft>(`/nfts/${id}`, { signal })).data,
    // 404 é uma resposta definitiva: não adianta tentar de novo
    retry: (count, error) =>
      !(axios.isAxiosError(error) && error.response?.status === 404) &&
      count < 2 &&
      isTransient(error),
  })