import { createContext, useContext } from 'react'

// Usuario de la sesión (GET /api/auth/me)
export interface User {
  id: string
  email: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  role: 'USER' | 'ADMIN'
  createdAt: string
}

export type AuthState =
  | { status: 'loading' } // comprobando si hay sesión al cargar la página
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: User }

export interface RegisterInput {
  email: string
  username: string
  password: string
  displayName?: string
}

export interface AuthContextValue {
  state: AuthState
  login: (email: string, password: string) => Promise<User>
  // Crea la cuenta y deja la sesión iniciada
  register: (input: RegisterInput) => Promise<User>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return value
}
