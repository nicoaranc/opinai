import type { ApiError } from '../api/client'

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <p className="status" role="status">
      {label}
    </p>
  )
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: ApiError
  onRetry?: () => void
}) {
  return (
    <div className="status status-error" role="alert">
      <p>{error.message}</p>
      {onRetry && (
        <button type="button" className="button" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  )
}
