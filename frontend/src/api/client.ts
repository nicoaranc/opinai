// Cliente HTTP del back. Todas las rutas van a /api en el mismo origen
// (proxy de Vite en local, rewrite de Render en producción), así que la
// cookie de sesión viaja sola.

// Forma de los errores del back (AllExceptionsFilter)
interface ErrorBody {
  statusCode: number
  message: string | string[]
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor')
  }

  if (response.status === 204) return undefined as T

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(response.status, body))
  }
  return body as T
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const { message } = body as ErrorBody
    // Los errores de validación llegan como lista ("email: Email inválido")
    if (Array.isArray(message)) return message.join('\n')
    if (message) return message
  }
  // El proxy de Vite responde 502/504 sin cuerpo si el back está apagado
  if (status >= 500) return 'El servidor no está disponible, inténtalo más tarde'
  return 'Algo salió mal'
}
