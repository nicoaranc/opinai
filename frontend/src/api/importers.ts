import { api } from './client'
import type { MediaDetail, MediaType } from './types'

// Fuentes externas desde las que se agregan obras al catálogo. Cada una tiene
// su propio formato de búsqueda en el back; aquí se unifican para la página
// de "Agregar".

export type Provider = 'tmdb' | 'deezer'

export interface ImportOption {
  id: string // ?tipo= en la URL
  label: string
  type: MediaType
}

export interface ImportSource {
  provider: Provider
  name: string // "TMDB", "Deezer"
  options: ImportOption[]
}

export interface SearchItem {
  id: number // ID en el proveedor
  type: MediaType
  title: string
  subtitle: string | null // título original, artista...
  detail: string | null // año, "Álbum · 12 canciones", duración...
  overview: string | null
  coverUrl: string | null
  importedSlug: string | null // si ya está en el catálogo
}

export interface SearchPage {
  items: SearchItem[]
  page: number
  totalPages: number
  total: number
}

interface TmdbItem {
  tmdbId: number
  type: MediaType
  title: string
  originalTitle: string | null
  year: number | null
  overview: string | null
  posterUrl: string | null
  importedSlug: string | null
}

interface DeezerItem {
  deezerId: number
  type: MediaType
  title: string
  artist: string
  albumTitle: string | null
  detail: string
  coverUrl: string | null
  explicit: boolean
  importedSlug: string | null
}

type RawPage<T> = Omit<SearchPage, 'items'> & { items: T[] }

export function searchPath(provider: Provider, type: MediaType, q: string, page: number) {
  return `/${provider}/search?${new URLSearchParams({ type, q, page: String(page) })}`
}

export function normalizePage(provider: Provider, raw: RawPage<unknown>): SearchPage {
  const items =
    provider === 'tmdb'
      ? (raw.items as TmdbItem[]).map(
          (i): SearchItem => ({
            id: i.tmdbId,
            type: i.type,
            title: i.title,
            subtitle: i.originalTitle,
            detail: i.year ? String(i.year) : null,
            overview: i.overview,
            coverUrl: i.posterUrl,
            importedSlug: i.importedSlug,
          }),
        )
      : (raw.items as DeezerItem[]).map(
          (i): SearchItem => ({
            id: i.deezerId,
            type: i.type,
            title: i.title,
            subtitle: [i.artist, i.albumTitle].filter(Boolean).join(' · '),
            detail: i.explicit ? `${i.detail} · Explícito` : i.detail,
            overview: null,
            coverUrl: i.coverUrl,
            importedSlug: i.importedSlug,
          }),
        )
  return { ...raw, items }
}

// Importa la obra (o devuelve la existente si ya estaba)
export function importItem(provider: Provider, type: MediaType, id: number) {
  const body = provider === 'tmdb' ? { type, tmdbId: id } : { type, deezerId: id }
  return api<{ created: boolean; media: MediaDetail }>(`/${provider}/imports`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
