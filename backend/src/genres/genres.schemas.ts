import { z } from 'zod';
import { slugSchema } from '../common/params.js';

export const createGenreSchema = z.strictObject({
  name: z.string().trim().min(1).max(50),
  // Si no se indica, se genera a partir del nombre
  slug: slugSchema.optional(),
});
export type CreateGenreDto = z.infer<typeof createGenreSchema>;

export const updateGenreSchema = createGenreSchema.partial();
export type UpdateGenreDto = z.infer<typeof updateGenreSchema>;
