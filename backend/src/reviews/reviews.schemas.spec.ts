import {
  createReviewSchema,
  listReviewsQuerySchema,
  reviewContentIssues,
  updateReviewSchema,
} from './reviews.schemas.js';

const valid = (input: unknown) => createReviewSchema.safeParse(input).success;

describe('createReviewSchema', () => {
  it('acepta solo nota, solo texto o ambos', () => {
    expect(valid({ rating: 8 })).toBe(true);
    expect(valid({ body: 'Me encantó' })).toBe(true);
    expect(valid({ rating: 8, title: 'Genial', body: 'Me encantó' })).toBe(
      true,
    );
  });

  it('rechaza una reseña sin nota ni texto', () => {
    expect(valid({})).toBe(false);
    expect(valid({ rating: null, body: '   ' })).toBe(false);
    expect(valid({ containsSpoilers: true })).toBe(false);
  });

  it('rechaza un título sin texto', () => {
    expect(valid({ rating: 8, title: 'Genial' })).toBe(false);
  });

  it('exige una nota entera entre 1 y 10', () => {
    expect(valid({ rating: 0 })).toBe(false);
    expect(valid({ rating: 11 })).toBe(false);
    expect(valid({ rating: 7.5 })).toBe(false);
  });

  it('convierte el texto vacío en null', () => {
    expect(createReviewSchema.parse({ rating: 5, body: '  ' }).body).toBeNull();
  });

  it('rechaza campos desconocidos', () => {
    expect(valid({ rating: 5, userId: 'otro' })).toBe(false);
  });
});

describe('reviewContentIssues (edición)', () => {
  it('detecta que se quitó la nota de una reseña sin texto', () => {
    const current = { rating: 8, title: null, body: null };
    const merged = {
      ...current,
      ...updateReviewSchema.parse({ rating: null }),
    };
    expect(reviewContentIssues(merged)).toHaveLength(1);
  });

  it('permite quitar la nota si queda texto', () => {
    const current = { rating: 8, title: null, body: 'Buena' };
    const merged = {
      ...current,
      ...updateReviewSchema.parse({ rating: null }),
    };
    expect(reviewContentIssues(merged)).toEqual([]);
  });
});

describe('listReviewsQuerySchema', () => {
  it('distingue "solo con texto", "solo valoraciones" y "todas"', () => {
    expect(listReviewsQuerySchema.parse({ withText: 'false' }).withText).toBe(
      false,
    );
    expect(listReviewsQuerySchema.parse({}).withText).toBeUndefined();
  });

  it('aplica valores por defecto y lee withText', () => {
    expect(listReviewsQuerySchema.parse({ withText: 'true' })).toEqual({
      page: 1,
      pageSize: 20,
      sort: 'recent',
      withText: true,
    });
  });
});
