import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { useAuth } from '../auth/auth-context'
import { useOpenAuthDialog } from '../auth/auth-dialog'
import { CATEGORIES } from '../lib/categories'

export function Header() {
  const { state, logout } = useAuth()
  const openAuth = useOpenAuthDialog()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
    } catch (error) {
      console.error(error)
      alert('No se pudo cerrar la sesión. Inténtalo de nuevo.')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          opinai
        </Link>

        <div className="header-actions" aria-live="polite">
          {state.status === 'authenticated' && (
            <>
              <span className="user-name">
                {state.user.displayName ?? state.user.username}
              </span>
              <button
                type="button"
                className="button"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                Cerrar sesión
              </button>
            </>
          )}
          {state.status === 'anonymous' && (
            <>
              <button
                type="button"
                className="button"
                onClick={() => openAuth('login')}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => openAuth('register')}
              >
                Crear cuenta
              </button>
            </>
          )}
        </div>
      </div>

      <nav className="nav" aria-label="Categorías">
        <ul className="nav-inner">
          {CATEGORIES.map((category) => (
            <li key={category.slug}>
              <NavLink to={`/${category.slug}`} className="nav-link">
                {category.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
