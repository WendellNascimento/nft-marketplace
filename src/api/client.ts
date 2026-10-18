import axios, { type AxiosError } from 'axios'
import { sessionStore } from '@/lib/session'
import type { ApiError } from '@/types/api'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 8000,
})

// quem decide o que fazer quando a sessão expira é registrado no main.tsx
let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler
}

api.interceptors.request.use((config) => {
  const session = sessionStore.get()
  if (session) config.headers.Authorization = `Bearer ${session.token}`
  else config.headers['X-Guest-Id'] = sessionStore.guestId()
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    // só conta como "expirou" se havia sessão. Login errado (sem sessão) não dispara isso.
    if (error.response?.status === 401 && sessionStore.get()) onUnauthorized()
    return Promise.reject(error)
  },
)

// erro "transitório": sem resposta (rede/timeout) ou 5xx. Só esses valem uma nova tentativa.
export const isTransient = (error: unknown) =>
  axios.isAxiosError(error) && (!error.response || error.response.status >= 500)

// lê o erro padronizado da API ({ code, message, fields })
export const getApiError = (error: unknown): ApiError | null =>
  axios.isAxiosError<ApiError>(error) ? (error.response?.data ?? null) : null