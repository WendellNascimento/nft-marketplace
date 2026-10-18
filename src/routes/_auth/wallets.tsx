import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { getApiError } from '@/api/client'
import { NETWORKS, useWalletMutations, useWallets } from '@/api/wallets'
import { FormField } from '@/components/FormField'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { zodFieldErrors } from '@/lib/forms'
import type { Wallet } from '@/types/api'

export const Route = createFileRoute('/_auth/wallets')({
  component: WalletsPage,
})

// mesma regra do mock: 0x + 40 caracteres hexadecimais
const walletSchema = z.object({
  label: z.string().trim().min(1, 'Informe um nome para a carteira.').max(30, 'Use no máximo 30 caracteres.'),
  address: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço inválido. Use 0x seguido de 40 caracteres hexadecimais.'),
  network: z.enum(['ethereum', 'polygon', 'base'], { error: 'Escolha uma rede válida.' }),
})

const networkLabel = (value: string) => NETWORKS.find((n) => n.value === value)?.label ?? value

// 0x1234…abcd
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

function WalletsPage() {
  const wallets = useWallets()
  const { update } = useWalletMutations()
  // null = formulário fechado | 'new' = cadastrando | Wallet = editando
  const [editing, setEditing] = useState<Wallet | 'new' | null>(null)

  const makePrimary = (wallet: Wallet) =>
    update.mutate(
      { id: wallet.id, isPrimary: true },
      {
        onSuccess: () => toast.success(`"${wallet.label}" agora é a carteira principal.`),
        onError: (error) =>
          toast.error(getApiError(error)?.message ?? 'Não foi possível alterar a carteira principal.'),
      },
    )

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Carteiras</h1>
        {editing === null && <Button onClick={() => setEditing('new')}>Adicionar carteira</Button>}
      </div>

      {editing !== null && (
        <WalletForm
          // key força um formulário novo ao trocar entre cadastrar e editar
          key={editing === 'new' ? 'new' : editing.id}
          wallet={editing === 'new' ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      )}

      <div className="mt-6">
        {wallets.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Carregando carteiras...
          </p>
        ) : wallets.isError ? (
          <div role="alert" className="grid gap-2">
            <p className="text-sm text-destructive">Não foi possível carregar suas carteiras.</p>
            <div>
              <Button variant="outline" onClick={() => wallets.refetch()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : wallets.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você ainda não cadastrou nenhuma carteira. A primeira será a principal.
          </p>
        ) : (
          <ul className="grid gap-3">
            {wallets.data.map((wallet) => (
              <li key={wallet.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{wallet.label}</p>
                  {wallet.isPrimary && <Badge>Principal</Badge>}
                  <Badge variant="outline">{networkLabel(wallet.network)}</Badge>
                </div>

                {/* abreviado para quem vê; endereço completo para leitor de tela */}
                <p className="mt-2 font-mono text-sm" title={wallet.address}>
                  <span aria-hidden="true">{shortAddress(wallet.address)}</span>
                  <span className="sr-only">{wallet.address}</span>
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(wallet)}>
                    Editar
                  </Button>
                  {!wallet.isPrimary && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={update.isPending}
                      onClick={() => makePrimary(wallet)}
                    >
                      Tornar principal
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// serve para cadastrar (sem wallet) e para editar (com wallet)
function WalletForm({ wallet, onDone }: { wallet?: Wallet; onDone: () => void }) {
  const { create, update } = useWalletMutations()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const pending = create.isPending || update.isPending

  const callbacks = {
    onSuccess: () => {
      toast.success(wallet ? 'Carteira atualizada.' : 'Carteira cadastrada.')
      onDone()
    },
    onError: (error: unknown) => {
      const apiError = getApiError(error)
      if (apiError?.fields) setErrors(apiError.fields)
      else setFormError(apiError?.message ?? 'Não foi possível salvar. Tente novamente.')
    },
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    const parsed = walletSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})
    if (wallet) update.mutate({ id: wallet.id, ...parsed.data }, callbacks)
    else create.mutate(parsed.data, callbacks)
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-4 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">{wallet ? 'Editar carteira' : 'Nova carteira'}</h2>

      <FormField id="label" label="Nome" defaultValue={wallet?.label} error={errors.label} autoFocus />
      <FormField
        id="address"
        label="Endereço"
        defaultValue={wallet?.address}
        error={errors.address}
        autoComplete="off"
        spellCheck={false}
        placeholder="0x..."
      />

      <div>
        <Label htmlFor="network">Rede</Label>
        <select
          id="network"
          name="network"
          defaultValue={wallet?.network ?? 'ethereum'}
          aria-invalid={!!errors.network}
          aria-describedby={errors.network ? 'network-error' : undefined}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {NETWORKS.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label}
            </option>
          ))}
        </select>
        {errors.network && (
          <p id="network-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.network}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}