import {
  CreatorKind,
  CreditRole,
  MediaType,
  SeriesStatus,
} from '../../generated/prisma/client.js';
import type { ImportedCredit, ImportedMedia } from '../imported-media.js';
import type {
  TmdbCrewMember,
  TmdbMovie,
  TmdbSearchResult,
  TmdbSeries,
  TmdbVideo,
} from './tmdb.types.js';

// Traduce las respuestas de TMDB al formato común (ImportedMedia).
// Funciones puras: se prueban sin red.

export const TMDB_PROVIDER = 'tmdb';
export type TmdbKind = 'movie' | 'tv';

// Las películas y las series de TMDB tienen numeraciones distintas: el ID
// externo lleva el tipo para que "movie:1396" y "tv:1396" no choquen
export const tmdbRef = (kind: TmdbKind, id: number) => ({
  provider: TMDB_PROVIDER,
  externalId: `${kind}:${id}`,
});

const IMAGE_BASE = 'https://image.tmdb.org/t/p';
// Se guarda un tamaño intermedio; el front puede pedir otro cambiando el
// segmento (w185, w342, w500, w780, original)
export const tmdbImage = (
  path: string | null | undefined,
  size: 'w185' | 'w500' | 'w1280',
): string | null => (path ? `${IMAGE_BASE}/${size}${path}` : null);

// Países de los que se toma la clasificación por edad, en orden
const RATING_COUNTRIES = ['CL', 'US'];

const SERIES_STATUS: Record<string, SeriesStatus> = {
  'Returning Series': SeriesStatus.RETURNING,
  Ended: SeriesStatus.ENDED,
  Canceled: SeriesStatus.CANCELED,
  'In Production': SeriesStatus.IN_PRODUCTION,
  Planned: SeriesStatus.IN_PRODUCTION,
  Pilot: SeriesStatus.IN_PRODUCTION,
};

const WRITER_JOBS = new Set(['Screenplay', 'Writer']);
const MAX_WRITERS = 3;

const clip = (text: string | null | undefined, max: number) => {
  const value = text?.trim();
  return value ? value.slice(0, max) : null;
};
const date = (value: string | null | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
const language = (value: string | null | undefined) =>
  value && /^[a-z]{2,3}$/.test(value) ? value : null;
const country = (value: string | null | undefined) =>
  value && /^[A-Z]{2}$/.test(value) ? value : null;
const positive = (value: number | null | undefined) =>
  value && value > 0 ? value : null;

// Tráiler oficial de YouTube, en español si existe
export function pickTrailer(videos: TmdbVideo[] = []): string | null {
  const trailers = videos.filter(
    (v) => v.site === 'YouTube' && v.type === 'Trailer',
  );
  const best =
    trailers.find((v) => v.iso_639_1 === 'es') ??
    trailers.find((v) => v.official) ??
    trailers[0];
  return best ? `https://www.youtube.com/watch?v=${best.key}` : null;
}

function firstRating(entries: { country: string; rating: string }[]) {
  for (const code of RATING_COUNTRIES) {
    const rating = entries.find((e) => e.country === code && e.rating)?.rating;
    if (rating) return rating.slice(0, 10);
  }
  return null;
}

const person = (
  p: { id: number; name: string; profile_path: string | null },
  role: CreditRole,
): ImportedCredit => ({
  ref: { provider: TMDB_PROVIDER, externalId: `person:${p.id}` },
  name: p.name,
  kind: CreatorKind.PERSON,
  imageUrl: tmdbImage(p.profile_path, 'w185'),
  role,
});

function movieCredits(crew: TmdbCrewMember[] = []): ImportedCredit[] {
  const directors = crew
    .filter((c) => c.job === 'Director')
    .map((c) => person(c, CreditRole.DIRECTOR));
  const writers = crew
    .filter((c) => WRITER_JOBS.has(c.job))
    .filter((c, i, all) => all.findIndex((o) => o.id === c.id) === i)
    .slice(0, MAX_WRITERS)
    .map((c) => person(c, CreditRole.WRITER));
  return [...directors, ...writers];
}

// `fallbackOverview`: sinopsis en inglés si no hay traducción al español
export function mapMovie(
  movie: TmdbMovie,
  fallbackOverview?: string | null,
): ImportedMedia {
  const title = clip(movie.title, 300) ?? clip(movie.original_title, 300) ?? '';
  const originalTitle = clip(movie.original_title, 300);
  return {
    type: MediaType.MOVIE,
    title,
    originalTitle: originalTitle !== title ? originalTitle : null,
    synopsis: clip(movie.overview, 10_000) ?? clip(fallbackOverview, 10_000),
    releaseDate: date(movie.release_date),
    coverUrl: tmdbImage(movie.poster_path, 'w500'),
    backdropUrl: tmdbImage(movie.backdrop_path, 'w1280'),
    language: language(movie.original_language),
    country: country(
      movie.origin_country?.[0] ?? movie.production_countries?.[0]?.iso_3166_1,
    ),
    genres: movie.genres.map((g) => g.name),
    details: {
      runtimeMinutes: positive(movie.runtime),
      ageRating: firstRating(
        (movie.release_dates?.results ?? []).flatMap((r) =>
          r.release_dates.map((d) => ({
            country: r.iso_3166_1,
            rating: d.certification,
          })),
        ),
      ),
      trailerUrl: pickTrailer(movie.videos?.results),
    },
    credits: movieCredits(movie.credits?.crew),
    externalIds: [
      tmdbRef('movie', movie.id),
      ...(movie.imdb_id
        ? [{ provider: 'imdb', externalId: movie.imdb_id }]
        : []),
    ],
  };
}

export function mapSeries(
  series: TmdbSeries,
  fallbackOverview?: string | null,
): ImportedMedia {
  const title = clip(series.name, 300) ?? clip(series.original_name, 300) ?? '';
  const originalTitle = clip(series.original_name, 300);
  const status = SERIES_STATUS[series.status] ?? null;
  const finished =
    status === SeriesStatus.ENDED || status === SeriesStatus.CANCELED;
  const imdb = series.external_ids?.imdb_id;
  return {
    type: MediaType.SERIES,
    title,
    originalTitle: originalTitle !== title ? originalTitle : null,
    synopsis: clip(series.overview, 10_000) ?? clip(fallbackOverview, 10_000),
    releaseDate: date(series.first_air_date),
    coverUrl: tmdbImage(series.poster_path, 'w500'),
    backdropUrl: tmdbImage(series.backdrop_path, 'w1280'),
    language: language(series.original_language),
    country: country(series.origin_country?.[0]),
    genres: series.genres.map((g) => g.name),
    details: {
      status,
      seasonsCount: positive(series.number_of_seasons),
      episodesCount: positive(series.number_of_episodes),
      endDate: finished ? date(series.last_air_date) : null,
      network: clip(series.networks?.[0]?.name, 100),
      ageRating: firstRating(
        (series.content_ratings?.results ?? []).map((r) => ({
          country: r.iso_3166_1,
          rating: r.rating,
        })),
      ),
      trailerUrl: pickTrailer(series.videos?.results),
    },
    credits: (series.created_by ?? []).map((c) =>
      person(c, CreditRole.SHOWRUNNER),
    ),
    externalIds: [
      tmdbRef('tv', series.id),
      ...(imdb ? [{ provider: 'imdb', externalId: imdb }] : []),
    ],
  };
}

// Resultado de búsqueda para el front
export function mapSearchResult(kind: TmdbKind, r: TmdbSearchResult) {
  const title = (kind === 'movie' ? r.title : r.name) ?? '';
  const originalTitle =
    (kind === 'movie' ? r.original_title : r.original_name) ?? null;
  const released = kind === 'movie' ? r.release_date : r.first_air_date;
  return {
    tmdbId: r.id,
    title,
    originalTitle: originalTitle !== title ? originalTitle : null,
    year: released ? Number(released.slice(0, 4)) || null : null,
    overview: clip(r.overview, 300),
    posterUrl: tmdbImage(r.poster_path, 'w185'),
  };
}
