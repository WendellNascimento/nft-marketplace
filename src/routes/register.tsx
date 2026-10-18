import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { getApiError } from '@/api/client'
import { registerRequest } from '@/api/session'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { zodFieldErrors } from '@/lib/forms'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

const formSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe seu nome.'),
    email: z.email('Informe um e-mail válido.'),
    password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'As senhas não conferem.',
    path: ['confirm'],
  })

function RegisterPage() {
  const navigate = useNavigate()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  const register = useMutation({
    mutationFn: registerRequest,
    onSuccess: () => {
      toast.success('Conta criada! Entre com seu e-mail e senha.')
      navigate({ to: '/login' })
    },
    onError: (error) => {
      const apiError = getApiError(error)
      if (apiError?.fields) setErrors(apiError.fields) // inclui o conflito de e-mail (409)
      else setFormError(apiError?.message ?? 'Não foi possível criar a conta. Tente novamente.')
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
    register.mutate({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
    })
  }

  return (
    <div className="mx-auto max-w-md p-4 md:p-8">
      <h1 className="text-2xl font-bold">Criar conta</h1>

      <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-4">
        <FormField id="name" label="Nome" autoComplete="name" error={errors.name} />
        <FormField id="email" label="E-mail" type="email" autoComplete="email" error={errors.email} />
        <FormField
          id="password"
          label="Senha"
          type="password"
          autoComplete="new-password"
          error={errors.password}
        />
        <FormField
          id="confirm"
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          error={errors.confirm}
        />
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? 'Criando...' : 'Criar conta'}
        </Button>
      </form>

      <p className="mt-4 text-sm">
        Já tem conta?{' '}
        <Link to="/login" className="underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}