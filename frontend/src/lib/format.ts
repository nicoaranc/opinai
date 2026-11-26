import type { CreditRole, MediaSummary, MediaType } from '../api/types'

export const TYPE_LABELS: Record<MediaType, string> = {
  MOVIE: 'Película',
  SERIES: 'Serie',
  ALBUM: 'Álbum',
  TRACK: 'Canción',
  GAME: 'Videojuego',
}

export const ROLE_LABELS: Record<CreditRole, string> = {
  DIRECTOR: 'Dirección',
  SHOWRUNNER: 'Creación',
  WRITER: 'Guion',
  PRIMARY_ARTIST: 'Artista',
  FEATURED_ARTIST: 'Colaboración',
  PRODUCER: 'Producción',
  DEVELOPER: 'Desarrollo',
  PUBLISHER: 'Distribución',
}

export const SERIES_STATUS_LABELS = {
  RETURNING: 'En emisión',
  ENDED: 'Finalizada',
  CANCELED: 'Cancelada',
  IN_PRODUCTION: 'En producción',
} as const

export const ALBUM_TYPE_LABELS = {
  ALBUM: 'Álbum',
  EP: 'EP',
  SINGLE: 'Sencillo',
  COMPILATION: 'Recopilatorio',
  LIVE: 'En vivo',
} as const

// Las fechas sin hora llegan como "2019-05-30T00:00:00.000Z": se leen en UTC
export function year(date: string | null): number | null {
  return date ? new Date(date).getUTCFullYear() : null
}

const dateFormat = new Intl.DateTimeFormat('es', {
  dateStyle: 'long',
  timeZone: 'UTC',
})
export function longDate(date: string): string {
  return dateFormat.format(new Date(date))
}

const relativeFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium' })
export function shortDate(date: string): string {
  return relativeFormat.format(new Date(date))
}

// Nota 1–10 → estrellas 0,5–5 con un decimal: 9.5 → "4,8"
const starsFormat = new Intl.NumberFormat('es', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
export function starsText(rating: number): string {
  return starsFormat.format(rating / 2)
}

export function duration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

export function runtime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h ${m} min` : `${m} min`
}

// "Bong Joon-ho", "Radiohead"... (créditos principales de la tarjeta)
export function mainCreators(media: Pick<MediaSummary, 'credits'>): string {
  const names = [...new Set(media.credits.map((c) => c.creator.name))]
  return names.join(', ')
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
