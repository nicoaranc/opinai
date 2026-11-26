import { Link } from 'react-router'

export function NotFoundPage({
  message = 'Esta página no existe.',
}: {
  message?: string
}) {
  return (
    <main className="page">
      <h1>No encontrado</h1>
      <p className="lead">{message}</p>
      <p>
        <Link to="/">Volver al inicio</Link>
      </p>
    </main>
  )
}
