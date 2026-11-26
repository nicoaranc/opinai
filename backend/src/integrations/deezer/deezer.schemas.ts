import { z } from 'zod';
import { MediaType } from '../../generated/prisma/client.js';

// De Deezer se importan álbumes y canciones
const deezerType = z.enum([MediaType.ALBUM, MediaType.TRACK]);

export const deezerSearchQuerySchema = z.object({
  type: deezerType,
  q: z.string().trim().min(1).max(100),
  page: z.coerce.number().int().min(1).max(50).default(1),
});
export type DeezerSearchQuery = z.infer<typeof deezerSearchQuerySchema>;

export const deezerImportSchema = z.strictObject({
  type: deezerType,
  deezerId: z.int().positive(),
});
export type DeezerImportDto = z.infer<typeof deezerImportSchema>;
