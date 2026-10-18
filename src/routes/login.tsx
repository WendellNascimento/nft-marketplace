import { useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { getApiError } from '@/api/client'
import { loginRequest } from '@/api/session'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { startSession } from '@/lib/auth'
import { zodFieldErrors } from '@/lib/forms'

// só aceitamos caminhos internos como destino (evita redirecionar para sites de fora)
const searchSchema = z.object({
  redirect: z
    .string()
    .refine((v) => v.startsWith('/') && !v.startsWith('//'))
    .optional()
    .catch(undefined),
  reason: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/login')({
  validateSearch: (search) => searchSchema.parse(search),
  component: LoginPage,
})

const formSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})

function LoginPage() {
  const { redirect, reason } = Route.useSearch()
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  const login = useMutation({
    mutationFn: loginRequest,
       onSuccess: async (session) => {
      await startSession(session) // espera o merge do carrinho terminar
      router.history.push(redirect ?? '/') // volta para onde o usuário estava
    },
    onError: (error) => {
      const apiError = getApiError(error)
      if (apiError?.fields) setErrors(apiError.fields)
      else setFormError(apiError?.message ?? 'Não foi possível entrar. Tente novamente.')
    },
  })

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    const parsed = formSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})
    login.mutate(parsed.data)
  }

  return (
    <div className="mx-auto max-w-md p-4 md:p-8">
      <h1 className="text-2xl font-bold">Entrar</h1>

      {reason === 'expired' && (
        <p role="status" className="mt-4 rounded-md border p-3 text-sm">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-4">
        <FormField id="email" label="E-mail" type="email" autoComplete="email" error={errors.email} />
        <FormField
          id="password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          error={errors.password}
        />
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>

      <p className="mt-4 text-sm">
        Não tem conta?{' '}
        <Link to="/register" className="underline">
          Criar conta
        </Link>
      </p>
      <p className="mt-6 text-xs">Conta de teste: ana@example.com / Senha@123</p>
    </div>
  )
}