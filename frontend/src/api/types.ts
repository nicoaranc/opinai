// Formas de las respuestas del back (ver architecture.md §7)

export type MediaType = 'MOVIE' | 'SERIES' | 'ALBUM' | 'TRACK' | 'GAME'

export type CreditRole =
  | 'DIRECTOR'
  | 'SHOWRUNNER'
  | 'WRITER'
  | 'PRIMARY_ARTIST'
  | 'FEATURED_ARTIST'
  | 'PRODUCER'
  | 'DEVELOPER'
  | 'PUBLISHER'

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CreatorSummary {
  id: string
  slug: string
  name: string
  kind: 'PERSON' | 'GROUP' | 'COMPANY'
  imageUrl: string | null
}

export interface Credit {
  role: CreditRole
  creator: CreatorSummary
}

export interface MediaSummary {
  id: string
  type: MediaType
  slug: string
  title: string
  originalTitle: string | null
  releaseDate: string | null
  coverUrl: string | null
  ratingAvg: number | null // 1–10
  ratingCount: number
  reviewCount: number
  credits: Credit[]
}

export interface Genre {
  id: string
  slug: string
  name: string
}

export interface UserSummary {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export interface ReviewFields {
  id: string
  rating: number | null // 1–10 = 0,5–5 estrellas
  title: string | null
  body: string | null
  containsSpoilers: boolean
  createdAt: string
  updatedAt: string
}

export interface MediaReview extends ReviewFields {
  user: UserSummary
}

export interface TrackEntry {
  discNumber: number
  trackNumber: number
  track: MediaSummary & {
    track: { durationSeconds: number | null; explicit: boolean } | null
  }
}

export interface AlbumEntry {
  discNumber: number
  trackNumber: number
  album: MediaSummary
}

// Campos de `details` según el tipo; todos pueden faltar o ser null
export interface MediaDetails {
  runtimeMinutes?: number | null
  ageRating?: string | null
  trailerUrl?: string | null
  status?: 'RETURNING' | 'ENDED' | 'CANCELED' | 'IN_PRODUCTION' | null
  seasonsCount?: number | null
  episodesCount?: number | null
  endDate?: string | null
  network?: string | null
  albumType?: 'ALBUM' | 'EP' | 'SINGLE' | 'COMPILATION' | 'LIVE'
  label?: string | null
  durationSeconds?: number | null
  explicit?: boolean
  previewUrl?: string | null
  platforms?: string[]
  gameModes?: string[]
}

export interface MediaDetail extends MediaSummary {
  synopsis: string | null
  backdropUrl: string | null
  language: string | null
  country: string | null
  details: MediaDetails | null
  genres: Genre[]
  ratingDistribution: { rating: number; count: number }[]
  tracks?: TrackEntry[]
  albums?: AlbumEntry[]
  myReview: ReviewFields | null
}

export interface ReviewInput {
  rating: number | null
  title: string | null
  body: string | null
  containsSpoilers: boolean
}
