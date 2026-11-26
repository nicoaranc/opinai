import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from './client'

interface Result<T> {
  requestKey?: string // petición a la que corresponde esta respuesta
  data?: T
  error?: ApiError
}

// GET a la API con estado de carga y error. Al recargar o cambiar de ruta se
// conservan los datos anteriores hasta que llegan los nuevos (sin parpadeo).
// `key`: cualquier valor que, al cambiar, obliga a volver a pedir los datos
// (p. ej. el usuario de la sesión).
export function useApi<T>(path: string, key?: unknown) {
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState<Result<T>>({})
  const requestKey = `${path}|${String(key)}|${version}`

  useEffect(() => {
    let cancelled = false
    api<T>(path)
      .then((data) => {
        if (!cancelled) setResult({ requestKey, data })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResult({
          requestKey,
          error:
            error instanceof ApiError
              ? error
              : new ApiError(0, 'Algo salió mal'),
        })
      })
    return () => {
      cancelled = true
    }
  }, [path, requestKey])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const current = result.requestKey === requestKey
  return {
    data: result.data,
    // El error solo se muestra si es de la petición actual
    error: current ? result.error : undefined,
    loading: !current,
    reload,
  }
}
