import { api } from './client'
import type { MediaDetail } from './types'

export interface TmdbSearchItem {
  tmdbId: number
  type: 'MOVIE' | 'SERIES'
  title: string
  originalTitle: string | null
  year: number | null
  overview: string | null
  posterUrl: string | null
  // Si ya está en el catálogo, su slug
  importedSlug: string | null
}

export interface TmdbSearchPage {
  items: TmdbSearchItem[]
  page: number
  totalPages: number
  total: number
}

// Importa la obra (o devuelve la existente si ya estaba)
export function importFromTmdb(type: 'MOVIE' | 'SERIES', tmdbId: number) {
  return api<{ created: boolean; media: MediaDetail }>('/tmdb/imports', {
    method: 'POST',
    body: JSON.stringify({ type, tmdbId }),
  })
}
