import { useState, type ReactNode } from 'react'
import { AuthDialogContext, type AuthMode } from '../auth/auth-dialog'
import { AuthDialog } from './AuthDialog'

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode | null>(null)
  return (
    <AuthDialogContext.Provider value={setMode}>
      {children}
      <AuthDialog
        mode={mode}
        onModeChange={setMode}
        onClose={() => setMode(null)}
      />
    </AuthDialogContext.Provider>
  )
}
