import { z } from 'zod';
import { MediaType } from '../../generated/prisma/client.js';

// TMDB solo tiene películas y series
const tmdbType = z.enum([MediaType.MOVIE, MediaType.SERIES]);

export const tmdbSearchQuerySchema = z.object({
  type: tmdbType,
  q: z.string().trim().min(1).max(100),
  page: z.coerce.number().int().min(1).max(500).default(1),
});
export type TmdbSearchQuery = z.infer<typeof tmdbSearchQuerySchema>;

export const tmdbImportSchema = z.strictObject({
  type: tmdbType,
  tmdbId: z.int().positive(),
});
export type TmdbImportDto = z.infer<typeof tmdbImportSchema>;
