import { z } from 'zod';
import { paginationSchema } from '../common/pagination.js';
import { MediaType } from '../generated/prisma/client.js';

// "" o solo espacios cuentan como vacío (null)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullish();

const fields = {
  rating: z.int().min(1).max(10).nullish(), // 1–10 = 0,5–5 estrellas
  title: optionalText(150),
  body: optionalText(10_000),
  containsSpoilers: z.boolean().optional(),
};

export interface ReviewContent {
  rating?: number | null;
  title?: string | null;
  body?: string | null;
}

// Reglas que debe cumplir la reseña completa (al crear y tras una edición)
export function reviewContentIssues(review: ReviewContent): string[] {
  const issues: string[] = [];
  if (review.rating == null && !review.body) {
    issues.push('La reseña necesita una nota, un texto o ambos');
  }
  if (review.title && !review.body) {
    issues.push('title: Una reseña con título necesita texto');
  }
  return issues;
}

export const createReviewSchema = z
  .strictObject(fields)
  .superRefine((review, ctx) => {
    for (const message of reviewContentIssues(review)) {
      ctx.addIssue({ code: 'custom', message });
    }
  });
export type CreateReviewDto = z.infer<typeof createReviewSchema>;

// Parcial: las reglas se comprueban en el servicio sobre el resultado final
export const updateReviewSchema = z.strictObject(fields);
export type UpdateReviewDto = z.infer<typeof updateReviewSchema>;

export const REVIEW_SORTS = [
  'recent',
  'oldest',
  'rating_desc', // mejor nota primero (las sin nota al final)
  'rating_asc',
] as const;

export const listReviewsQuerySchema = paginationSchema.extend({
  sort: z.enum(REVIEW_SORTS).default('recent'),
  // true: solo reseñas con texto · false: solo valoraciones (nota sin
  // texto) · sin indicar: todas
  withText: z.stringbool().optional(),
});
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;

export const listUserReviewsQuerySchema = listReviewsQuerySchema.extend({
  type: z.enum(MediaType).optional(),
});
export type ListUserReviewsQuery = z.infer<typeof listUserReviewsQuerySchema>;
