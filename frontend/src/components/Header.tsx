import { useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { AuthDialog, type AuthMode } from './AuthDialog'

export function Header() {
  const { state, logout } = useAuth()
  const [dialogMode, setDialogMode] = useState<AuthMode | null>(null)
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
        <a href="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          opinai
        </a>

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
                onClick={() => setDialogMode('login')}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => setDialogMode('register')}
              >
                Crear cuenta
              </button>
            </>
          )}
        </div>
      </div>

      <AuthDialog
        mode={dialogMode}
        onModeChange={setDialogMode}
        onClose={() => setDialogMode(null)}
      />
    </header>
  )
}
