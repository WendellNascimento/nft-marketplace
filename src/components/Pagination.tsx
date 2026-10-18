import { Button } from '@/components/ui/button'

interface Props {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

export function Pagination({ page, totalPages, onChange }: Props) {
  return (
    <nav aria-label="Paginação" className="mt-8 flex items-center justify-center gap-4">
      <Button variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </Button>
      <span aria-live="polite">
        Página {page} de {totalPages}
      </span>
      <Button variant="outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Próxima
      </Button>
    </nav>
  )
}