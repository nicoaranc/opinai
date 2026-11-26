export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <nav className="pagination" aria-label="Paginación">
      <button
        type="button"
        className="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Anterior
      </button>
      <span>
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        className="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Siguiente
      </button>
    </nav>
  )
}
