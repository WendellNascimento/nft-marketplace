export function CartSkeleton() {
  return (
    <div aria-label="Carregando carrinho" className="grid gap-8 md:grid-cols-[1fr_320px]">
      <ul className="grid gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="flex gap-4 rounded-lg border p-4">
            <div className="skeleton size-24 shrink-0" />
            <div className="grid flex-1 gap-2">
              <div className="skeleton h-5 w-2/3" />
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton h-9 w-24" />
            </div>
          </li>
        ))}
      </ul>
      <div className="skeleton h-72 w-full" />
    </div>
  )
}