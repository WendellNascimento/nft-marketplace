import { createFileRoute } from '@tanstack/react-router'
import { useState, type ChangeEvent, type ComponentProps } from 'react'
import { toast } from 'sonner'
import { readFieldErrors, useChangePassword, useProfile, useUpdateProfile } from '@/api/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { User } from '@/types/api'

export const Route = createFileRoute('/_auth/profile')({
  component: ProfilePage,
})

const MAX_AVATAR_BYTES = 200 * 1024 // 200 KB
const EMAIL = /^\S+@\S+\.\S+$/

type Errors = Record<string, string>

// campo com label, aria-invalid e erro associado (leitor de tela lê o erro)
function TextField({
  id,
  label,
  error,
  ...props
}: { id: string; label: string; error?: string } & Omit<ComponentProps<'input'>, 'id'>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function ProfileForm({ user }: { user: User }) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [avatar, setAvatar] = useState<string | null>(user.avatarUrl)
  const [errors, setErrors] = useState<Errors>({})
  const update = useUpdateProfile()

  // lê a imagem escolhida e guarda como data URL (texto base64)
  function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, avatar: 'Escolha um arquivo de imagem.' }))
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setErrors((prev) => ({ ...prev, avatar: 'A imagem é grande demais (máximo 200 KB).' }))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAvatar(reader.result as string)
      setErrors((prev) => ({ ...prev, avatar: '' }))
    }
    reader.onerror = () => setErrors((prev) => ({ ...prev, avatar: 'Não foi possível ler a imagem.' }))
    reader.readAsDataURL(file)
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const found: Errors = {}
    if (!name.trim()) found.name = 'Informe seu nome.'
    if (!EMAIL.test(email.trim())) found.email = 'Informe um e-mail válido.'
    setErrors(found)
    if (Object.keys(found).length) return

    update.mutate(
      { name, email, avatarUrl: avatar },
      {
        onSuccess: () => toast.success('Perfil atualizado.'),
        onError: (error) => {
          const { message, fields } = readFieldErrors(error)
          setErrors(fields)
          if (!Object.keys(fields).length) toast.error(message)
        },
      },
    )
  }

  return (
    <section className="space-y-4 rounded-xl border p-4 sm:p-6" aria-labelledby="dados-titulo">
      <h2 id="dados-titulo" className="text-lg font-semibold">
        Dados pessoais
      </h2>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="flex items-center gap-4">
          {avatar ? (
            <img
              src={avatar}
              alt="Sua foto de perfil"
              width={80}
              height={80}
              className="size-20 rounded-full object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex size-20 items-center justify-center rounded-full bg-muted text-2xl font-semibold"
            >
              {name.trim().charAt(0).toUpperCase() || '?'}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="avatar">Foto de perfil</Label>
            <Input
              id="avatar"
              type="file"
              accept="image/*"
              onChange={onPickFile}
              aria-invalid={!!errors.avatar}
              aria-describedby={errors.avatar ? 'avatar-error' : undefined}
            />
            {avatar && (
              <Button type="button" variant="outline" size="sm" onClick={() => setAvatar(null)}>
                Remover foto
              </Button>
            )}
          </div>
        </div>
        {errors.avatar && (
          <p id="avatar-error" role="alert" className="text-sm text-destructive">
            {errors.avatar}
          </p>
        )}

        <TextField
          id="name"
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoComplete="name"
        />
        <TextField
          id="email"
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />

        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </form>
    </section>
  )
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const change = useChangePassword()

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const found: Errors = {}
    if (!currentPassword) found.currentPassword = 'Informe a senha atual.'
    if (newPassword.length < 8) found.newPassword = 'A nova senha precisa ter pelo menos 8 caracteres.'
    if (confirm !== newPassword) found.confirm = 'As senhas não conferem.'
    setErrors(found)
    if (Object.keys(found).length) return

    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast.success('Senha alterada.')
          setCurrentPassword('')
          setNewPassword('')
          setConfirm('')
        },
        onError: (error) => {
          const { message, fields } = readFieldErrors(error)
          setErrors(fields)
          if (!Object.keys(fields).length) toast.error(message)
        },
      },
    )
  }

  return (
    <section className="space-y-4 rounded-xl border p-4 sm:p-6" aria-labelledby="senha-titulo">
      <h2 id="senha-titulo" className="text-lg font-semibold">
        Alterar senha
      </h2>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField
          id="currentPassword"
          label="Senha atual"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          error={errors.currentPassword}
          autoComplete="current-password"
        />
        <TextField
          id="newPassword"
          label="Nova senha"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={errors.newPassword}
          autoComplete="new-password"
        />
        <TextField
          id="confirm"
          label="Confirmar nova senha"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
          autoComplete="new-password"
        />
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? 'Alterando...' : 'Alterar senha'}
        </Button>
      </form>
    </section>
  )
}

function ProfilePage() {
  const profile = useProfile()

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Meu perfil</h1>

      {profile.isPending && <p role="status">Carregando perfil...</p>}

      {profile.isError && (
        <div role="alert" className="space-y-2">
          <p>Não foi possível carregar seu perfil.</p>
          <Button variant="outline" onClick={() => profile.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {profile.data && (
        <>
          <ProfileForm key={profile.data.id} user={profile.data} />
          <PasswordForm />
        </>
      )}
    </main>
  )
}