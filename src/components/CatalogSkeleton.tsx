export function CatalogSkeleton() {
  return (
    <ul
      aria-label="Carregando NFTs"
      className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: 12 }, (_, i) => (
        <li key={i}>
          <div className="skeleton aspect-square w-full" />
          <div className="skeleton mt-3 h-6 w-3/4" />
          <div className="skeleton mt-1 h-5 w-1/3" />
        </li>
      ))}
    </ul>
  )
}