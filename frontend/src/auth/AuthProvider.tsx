import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError } from '../api/client'
import {
  AuthContext,
  type AuthState,
  type RegisterInput,
  type User,
} from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  // Al cargar, la cookie (si existe) dice si ya hay sesión
  useEffect(() => {
    let cancelled = false
    api<{ user: User }>('/auth/me')
      .then(({ user }) => {
        if (!cancelled) setState({ status: 'authenticated', user })
      })
      .catch((error: unknown) => {
        // 401 = sin sesión. Si el back no responde, también se trata como
        // anónimo: el error se verá al intentar iniciar sesión.
        if (!(error instanceof ApiError)) console.error(error)
        if (!cancelled) setState({ status: 'anonymous' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setState({ status: 'authenticated', user })
    return user
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const { user } = await api<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    setState({ status: 'authenticated', user })
    return user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api<void>('/auth/logout', { method: 'POST' })
    } catch (error) {
      // 401: la sesión ya había caducado en el servidor; igual se sale
      if (!(error instanceof ApiError && error.status === 401)) throw error
    }
    setState({ status: 'anonymous' })
  }, [])

  const value = useMemo(
    () => ({ state, login, register, logout }),
    [state, login, register, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
