import { z } from 'zod';
import { paginationSchema } from '../common/pagination.js';
import { slugSchema } from '../common/params.js';
import {
  CreatorKind,
  CreditRole,
  MediaType,
} from '../generated/prisma/client.js';

const country = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, { error: 'Código de país ISO de 2 letras, p. ej. CL' });

export const listCreatorsQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
  kind: z.enum(CreatorKind).optional(),
});
export type ListCreatorsQuery = z.infer<typeof listCreatorsQuerySchema>;

export const creatorMediaQuerySchema = paginationSchema.extend({
  role: z.enum(CreditRole).optional(),
  type: z.enum(MediaType).optional(),
});
export type CreatorMediaQuery = z.infer<typeof creatorMediaQuerySchema>;

export const createCreatorSchema = z.strictObject({
  kind: z.enum(CreatorKind),
  name: z.string().trim().min(1).max(150),
  // Si no se indica, se genera a partir del nombre
  slug: slugSchema.optional(),
  bio: z.string().trim().max(5000).nullish(),
  imageUrl: z.url().nullish(),
  country: country.nullish(),
});
export type CreateCreatorDto = z.infer<typeof createCreatorSchema>;

export const updateCreatorSchema = createCreatorSchema.partial();
export type UpdateCreatorDto = z.infer<typeof updateCreatorSchema>;
