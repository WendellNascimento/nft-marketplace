import type { Session } from '@/types/api'
import { api } from './client'

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  name: string
  email: string
  password: string
}

export const loginRequest = async (input: LoginInput) =>
  (await api.post<Session>('/session/login', input)).data

export const registerRequest = async (input: RegisterInput) =>
  (await api.post<{ ok: true }>('/session/register', input)).data