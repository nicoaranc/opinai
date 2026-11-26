import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/auth-context'

export type AuthMode = 'login' | 'register'

interface Props {
  // null = cerrada
  mode: AuthMode | null
  onModeChange: (mode: AuthMode) => void
  onClose: () => void
}

const TITLES: Record<AuthMode, string> = {
  login: 'Iniciar sesión',
  register: 'Crear cuenta',
}

// Ventana de inicio de sesión y registro (<dialog> nativo: gestiona el foco
// y se cierra con Escape)
export function AuthDialog({ mode, onModeChange, onClose }: Props) {
  const { login, register } = useAuth()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const titleId = useId()
  const hintId = useId()

  const open = mode !== null
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function reset() {
    setPassword('')
    setUsername('')
    setDisplayName('')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  // El email se conserva al cambiar de modo
  function switchTo(next: AuthMode) {
    setPassword('')
    setError(null)
    onModeChange(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mode) return
    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register({
          email,
          username,
          password,
          displayName: displayName.trim() || undefined,
        })
      }
      setEmail('')
      dialogRef.current?.close() // dispara onClose → handleClose
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal')
    } finally {
      setSubmitting(false)
    }
  }

  const isRegister = mode === 'register'
  const title = mode ? TITLES[mode] : ''

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      onClose={handleClose}
      // Clic fuera de la tarjeta (sobre el fondo) cierra la ventana
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close()
      }}
    >
      <form className="dialog-card" onSubmit={handleSubmit}>
        <div className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        {isRegister && (
          <>
            <label className="field">
              <span>Nombre de usuario</span>
              <input
                type="text"
                name="username"
                autoComplete="username"
                required
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_]+"
                aria-describedby={hintId}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <small id={hintId} className="field-hint">
                De 3 a 30 caracteres: letras, números y guiones bajos. Se
                guarda en minúsculas.
              </small>
            </label>

            <label className="field">
              <span>
                Nombre visible <span className="optional">(opcional)</span>
              </span>
              <input
                type="text"
                name="displayName"
                autoComplete="name"
                maxLength={50}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
          </>
        )}

        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            name="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            minLength={isRegister ? 8 : undefined}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {isRegister && <small className="field-hint">Mínimo 8 caracteres.</small>}
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button button-primary" disabled={submitting}>
          {submitting
            ? isRegister
              ? 'Creando cuenta…'
              : 'Entrando…'
            : isRegister
              ? 'Crear cuenta'
              : 'Entrar'}
        </button>

        <p className="dialog-switch">
          {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => switchTo(isRegister ? 'login' : 'register')}
          >
            {isRegister ? 'Inicia sesión' : 'Crea una'}
          </button>
        </p>
      </form>
    </dialog>
  )
}
