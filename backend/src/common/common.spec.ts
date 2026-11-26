import { pageArgs, paginationSchema, toPage } from './pagination.js';
import { isoDateSchema, slugSchema, whereIdOrSlug } from './params.js';
import { slugify, uniqueSlug } from './slug.js';

describe('slugify', () => {
  it.each([
    ['Parásitos (2019)!', 'parasitos-2019'],
    ['  OK   Computer ', 'ok-computer'],
    ['Exit Music (For a Film)', 'exit-music-for-a-film'],
    ['기생충', ''],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('uniqueSlug', () => {
  it('añade un sufijo hasta encontrar uno libre', async () => {
    const taken = new Set(['dune', 'dune-2']);
    await expect(
      uniqueSlug('Dune', (s) => Promise.resolve(taken.has(s))),
    ).resolves.toBe('dune-3');
  });

  it('usa el fallback si el texto no deja nada', async () => {
    await expect(
      uniqueSlug('기생충', () => Promise.resolve(false), 'movie-2019'),
    ).resolves.toBe('movie-2019');
  });
});

describe('paginación', () => {
  it('aplica valores por defecto y calcula skip/take', () => {
    const p = paginationSchema.parse({ page: '3' });
    expect(p).toEqual({ page: 3, pageSize: 20 });
    expect(pageArgs(p)).toEqual({ skip: 40, take: 20 });
  });

  it('rechaza pageSize por encima del máximo', () => {
    expect(paginationSchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });

  it('calcula totalPages', () => {
    expect(toPage([], 41, { page: 1, pageSize: 20 }).totalPages).toBe(3);
  });
});

describe('params', () => {
  it('distingue ID de slug', () => {
    expect(whereIdOrSlug('01a21509-52c7-73c9-ab5a-6c2bdeb64d74')).toEqual({
      id: '01a21509-52c7-73c9-ab5a-6c2bdeb64d74',
    });
    expect(whereIdOrSlug('Parasite-2019')).toEqual({ slug: 'parasite-2019' });
  });

  it('valida slugs', () => {
    expect(slugSchema.safeParse('ok-computer').success).toBe(true);
    expect(slugSchema.safeParse('ok computer').success).toBe(false);
    expect(slugSchema.safeParse('-ok').success).toBe(false);
  });

  it('convierte fechas AAAA-MM-DD a medianoche UTC', () => {
    expect(isoDateSchema.parse('2019-05-30').toISOString()).toBe(
      '2019-05-30T00:00:00.000Z',
    );
    expect(isoDateSchema.safeParse('30/05/2019').success).toBe(false);
  });
});
