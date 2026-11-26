import { z } from 'zod';
import { paginationSchema } from '../common/pagination.js';
import { isoDateSchema, slugSchema, uuidSchema } from '../common/params.js';
import {
  AlbumType,
  CreditRole,
  MediaType,
  SeriesStatus,
} from '../generated/prisma/client.js';

// ── Consultas ─────────────────────────────────

export const MEDIA_SORTS = [
  'recent', // fecha de estreno, más nuevas primero (por defecto)
  'oldest', // fecha de estreno, más antiguas primero
  'title', // alfabético
  'rating', // mejor nota promedio
  'popular', // más reseñas
  'added', // agregadas al catálogo más recientemente
] as const;

// ?type=MOVIE,SERIES → [MOVIE, SERIES]
const mediaTypeList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(MediaType)).min(1));

export const listMediaQuerySchema = paginationSchema.extend({
  // Uno o varios tipos separados por comas. Sin indicar: todos menos TRACK,
  // para que las canciones no inunden el catálogo.
  type: mediaTypeList.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  genre: slugSchema.optional(),
  creator: slugSchema.optional(),
  year: z.coerce.number().int().min(1800).max(2200).optional(),
  sort: z.enum(MEDIA_SORTS).default('recent'),
});
export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;

// ── Detalles por tipo ─────────────────────────

const shortText = (max: number) => z.string().trim().min(1).max(max);
const positiveInt = z.int().positive();
const tagList = z.array(shortText(50)).max(30);

export const movieDetailsSchema = z.strictObject({
  runtimeMinutes: positiveInt.max(1000).nullish(),
  ageRating: shortText(10).nullish(),
  trailerUrl: z.url().nullish(),
});

export const seriesDetailsSchema = z.strictObject({
  status: z.enum(SeriesStatus).nullish(),
  seasonsCount: positiveInt.max(500).nullish(),
  episodesCount: positiveInt.max(50_000).nullish(),
  endDate: isoDateSchema.nullish(),
  network: shortText(100).nullish(),
  ageRating: shortText(10).nullish(),
  trailerUrl: z.url().nullish(),
});

export const albumDetailsSchema = z.strictObject({
  albumType: z.enum(AlbumType).default(AlbumType.ALBUM),
  label: shortText(150).nullish(),
});

export const trackDetailsSchema = z.strictObject({
  durationSeconds: positiveInt.max(24 * 60 * 60).nullish(),
  explicit: z.boolean().default(false),
  previewUrl: z.url().nullish(),
});

export const gameDetailsSchema = z.strictObject({
  platforms: tagList.default([]),
  gameModes: tagList.default([]),
  trailerUrl: z.url().nullish(),
});

export const DETAILS_SCHEMAS = {
  MOVIE: movieDetailsSchema,
  SERIES: seriesDetailsSchema,
  ALBUM: albumDetailsSchema,
  TRACK: trackDetailsSchema,
  GAME: gameDetailsSchema,
} as const satisfies Record<MediaType, z.ZodType>;

// Roles de crédito que tienen sentido en cada tipo de obra
export const ALLOWED_ROLES: Record<MediaType, CreditRole[]> = {
  MOVIE: [CreditRole.DIRECTOR, CreditRole.WRITER, CreditRole.PRODUCER],
  SERIES: [
    CreditRole.SHOWRUNNER,
    CreditRole.DIRECTOR,
    CreditRole.WRITER,
    CreditRole.PRODUCER,
  ],
  ALBUM: [
    CreditRole.PRIMARY_ARTIST,
    CreditRole.FEATURED_ARTIST,
    CreditRole.PRODUCER,
  ],
  TRACK: [
    CreditRole.PRIMARY_ARTIST,
    CreditRole.FEATURED_ARTIST,
    CreditRole.PRODUCER,
    CreditRole.WRITER,
  ],
  GAME: [
    CreditRole.DEVELOPER,
    CreditRole.PUBLISHER,
    CreditRole.DIRECTOR,
    CreditRole.WRITER,
  ],
};

// ── Alta y edición ────────────────────────────

const creditInput = z.strictObject({
  creatorId: uuidSchema,
  role: z.enum(CreditRole),
  position: z.int().min(0).max(1000).optional(),
});

const uniqueCredits = (
  credits: z.infer<typeof creditInput>[] | undefined,
): boolean => {
  if (!credits) return true;
  const keys = credits.map((c) => `${c.creatorId}:${c.role}`);
  return new Set(keys).size === keys.length;
};

const commonFields = {
  title: shortText(300),
  originalTitle: shortText(300).nullish(),
  // Si no se indica, se genera a partir del título y el año
  slug: slugSchema.optional(),
  synopsis: z.string().trim().max(10_000).nullish(),
  releaseDate: isoDateSchema.nullish(),
  coverUrl: z.url().nullish(),
  backdropUrl: z.url().nullish(),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, { error: 'Código ISO 639-1, p. ej. es' })
    .nullish(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, { error: 'Código de país ISO de 2 letras, p. ej. CL' })
    .nullish(),
  // Slugs de géneros existentes; reemplaza la lista completa
  genres: z.array(slugSchema).max(20).optional(),
  // Reemplaza la lista completa de créditos
  credits: z
    .array(creditInput)
    .max(100)
    .refine(uniqueCredits, {
      error: 'Un creador no puede repetir el mismo rol',
    })
    .optional(),
};

const createVariant = <T extends MediaType, S extends z.ZodType>(
  type: T,
  details: S,
) =>
  z.strictObject({
    ...commonFields,
    type: z.literal(type),
    // Sin `details` se crean vacíos (con sus valores por defecto)
    details: details.optional(),
  });

export const createMediaSchema = z.discriminatedUnion('type', [
  createVariant(MediaType.MOVIE, movieDetailsSchema),
  createVariant(MediaType.SERIES, seriesDetailsSchema),
  createVariant(MediaType.ALBUM, albumDetailsSchema),
  createVariant(MediaType.TRACK, trackDetailsSchema),
  createVariant(MediaType.GAME, gameDetailsSchema),
]);
export type CreateMediaDto = z.infer<typeof createMediaSchema>;

// El tipo no se puede cambiar. `details` se valida en el servicio con el
// esquema del tipo de la obra (todos sus campos opcionales).
export const updateMediaSchema = z.strictObject({
  ...z.object(commonFields).partial().shape,
  details: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateMediaDto = z.infer<typeof updateMediaSchema>;

// Lista de canciones de un álbum (reemplaza la existente)
export const setTracksSchema = z.strictObject({
  tracks: z
    .array(
      z.strictObject({
        trackId: uuidSchema,
        discNumber: z.int().min(1).max(50).default(1),
        trackNumber: z.int().min(1).max(500),
      }),
    )
    .max(500)
    .refine(
      (tracks) => new Set(tracks.map((t) => t.trackId)).size === tracks.length,
      { error: 'Una canción no puede repetirse en el mismo álbum' },
    )
    .refine(
      (tracks) =>
        new Set(tracks.map((t) => `${t.discNumber}:${t.trackNumber}`)).size ===
        tracks.length,
      { error: 'Dos canciones no pueden ocupar la misma posición' },
    ),
});
export type SetTracksDto = z.infer<typeof setTracksSchema>;
