import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props extends React.ComponentProps<'input'> {
  id: string
  label: string
  error?: string
}

// label ligado ao campo, erro anunciado por leitores de tela e marcado com aria-invalid
export function FormField({ id, label, error, ...inputProps }: Props) {
  const errorId = `${id}-error`
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}