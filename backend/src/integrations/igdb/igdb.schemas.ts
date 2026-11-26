import { z } from 'zod';

export const igdbSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  page: z.coerce.number().int().min(1).max(50).default(1),
});
export type IgdbSearchQuery = z.infer<typeof igdbSearchQuerySchema>;

export const igdbImportSchema = z.strictObject({
  igdbId: z.int().positive(),
});
export type IgdbImportDto = z.infer<typeof igdbImportSchema>;
