import {
  createMediaSchema,
  listMediaQuerySchema,
  setTracksSchema,
} from './media.schemas.js';

const uuid = (n: number) =>
  `01a21509-52c7-73c9-ab5a-${String(n).padStart(12, '0')}`;

describe('createMediaSchema', () => {
  it('valida los detalles según el tipo', () => {
    const movie = createMediaSchema.parse({
      type: 'MOVIE',
      title: 'Dune',
      releaseDate: '2021-10-22',
      details: { runtimeMinutes: 155 },
    });
    expect(movie.releaseDate?.toISOString()).toBe('2021-10-22T00:00:00.000Z');

    // platforms es de GAME, no de MOVIE
    expect(
      createMediaSchema.safeParse({
        type: 'MOVIE',
        title: 'Dune',
        details: { platforms: ['PC'] },
      }).success,
    ).toBe(false);
  });

  it('rechaza un tipo desconocido o un campo que no existe', () => {
    expect(
      createMediaSchema.safeParse({ type: 'BOOK', title: 'X' }).success,
    ).toBe(false);
    expect(
      createMediaSchema.safeParse({ type: 'GAME', title: 'X', ratingAvg: 10 })
        .success,
    ).toBe(false);
  });

  it('rechaza el mismo creador repetido con el mismo rol', () => {
    const credit = { creatorId: uuid(1), role: 'DEVELOPER' };
    expect(
      createMediaSchema.safeParse({
        type: 'GAME',
        title: 'X',
        credits: [credit, credit],
      }).success,
    ).toBe(false);
  });
});

describe('listMediaQuerySchema', () => {
  it('acepta varios tipos separados por comas', () => {
    expect(listMediaQuerySchema.parse({ type: 'movie, SERIES' }).type).toEqual([
      'MOVIE',
      'SERIES',
    ]);
    expect(listMediaQuerySchema.safeParse({ type: 'MOVIE,BOOK' }).success).toBe(
      false,
    );
  });

  it('ordena por fecha de estreno por defecto', () => {
    expect(listMediaQuerySchema.parse({}).sort).toBe('recent');
  });
});

describe('setTracksSchema', () => {
  it('rechaza canciones o posiciones repetidas', () => {
    const t1 = { trackId: uuid(1), trackNumber: 1 };
    expect(
      setTracksSchema.safeParse({ tracks: [t1, { ...t1, trackNumber: 2 }] })
        .success,
    ).toBe(false);
    expect(
      setTracksSchema.safeParse({
        tracks: [t1, { trackId: uuid(2), trackNumber: 1 }],
      }).success,
    ).toBe(false);
    expect(
      setTracksSchema.parse({
        tracks: [t1, { trackId: uuid(2), trackNumber: 2 }],
      }).tracks[0].discNumber,
    ).toBe(1);
  });
});
