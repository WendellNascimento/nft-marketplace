export function DetailSkeleton() {
  return (
    <div
      aria-label="Carregando NFT"
      className="mx-auto grid max-w-6xl gap-8 p-4 md:grid-cols-2 md:p-8"
    >
      <div>
        <div className="skeleton aspect-square w-full" />
        <div className="mt-3 flex gap-2">
          <div className="skeleton size-16" />
          <div className="skeleton size-16" />
        </div>
      </div>
      <div>
        <div className="skeleton h-9 w-3/4" />
        <div className="skeleton mt-3 h-5 w-1/3" />
        <div className="skeleton mt-6 h-20 w-full" />
        <div className="skeleton mt-6 h-24 w-full" />
        <div className="skeleton mt-6 h-10 w-1/2" />
      </div>
    </div>
  )
}