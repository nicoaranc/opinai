import { useAuth } from '../auth/auth-context'

// Página principal. Todavía no carga datos del catálogo.
export function HomePage() {
  const { state } = useAuth()
  const name =
    state.status === 'authenticated'
      ? (state.user.displayName ?? state.user.username)
      : null

  return (
    <main className="home">
      <h1>{name ? `Hola, ${name}` : 'Opina de lo que ves, escuchas y juegas'}</h1>
      <p className="lead">
        Reseñas y valoraciones de películas, series, música y videojuegos.
      </p>
    </main>
  )
}
