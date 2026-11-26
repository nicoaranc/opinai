import { createContext, useContext } from 'react'

export type AuthMode = 'login' | 'register'

// Abre la ventana de login o registro desde cualquier componente
export const AuthDialogContext = createContext<
  ((mode: AuthMode) => void) | null
>(null)

export function useOpenAuthDialog() {
  const open = useContext(AuthDialogContext)
  if (!open) {
    throw new Error('useOpenAuthDialog debe usarse dentro de <AuthDialogProvider>')
  }
  return open
}
