import { createMediaSchema } from '../../media/media.schemas.js';
import type { ImportedMedia } from '../imported-media.js';
import {
  igdbRef,
  mapGame,
  mapSearchHit,
  quote,
  releaseDate,
} from './igdb.mapper.js';
import type { IgdbGame } from './igdb.types.js';

const withoutRelations = ({
  credits: _credits,
  genres: _genres,
  externalIds: _externalIds,
  ...rest
}: ImportedMedia) => rest;

const game: IgdbGame = {
  id: 14593,
  name: 'Hollow Knight',
  summary:
    'A 2D metroidvania with an emphasis on close combat and exploration.',
  first_release_date: 1487894400, // 2017-02-24
  cover: { image_id: 'cobfzp' },
  artworks: [{ image_id: 'ar1' }],
  genres: [
    { id: 8, name: 'Platform' },
    { id: 31, name: 'Adventure' },
    { id: 32, name: 'Indie' },
    { id: 99, name: 'Género nuevo' },
  ],
  game_modes: [{ id: 1, name: 'Single player' }],
  platforms: [
    { id: 6, name: 'PC (Microsoft Windows)' },
    { id: 130, name: 'Nintendo Switch' },
  ],
  involved_companies: [
    {
      developer: true,
      publisher: true,
      company: { id: 7263, name: 'Team Cherry', logo: { image_id: 'lg1' } },
    },
    { developer: false, publisher: true, company: { id: 1, name: 'Otra' } },
  ],
  videos: [
    { video_id: 'gameplay', name: 'Gameplay' },
    { video_id: 'Y2amTl5lBYM', name: 'Trailer' },
  ],
};

describe('mapGame', () => {
  const result = mapGame(game);

  it('traduce campos, imágenes y fecha', () => {
    expect(result).toMatchObject({
      type: 'GAME',
      title: 'Hollow Knight',
      releaseDate: '2017-02-24',
      coverUrl:
        'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cobfzp.jpg',
      backdropUrl: 'https://images.igdb.com/igdb/image/upload/t_1080p/ar1.jpg',
    });
  });

  it('traduce géneros, modos y plataformas conocidos y conserva el resto', () => {
    expect(result.genres).toEqual([
      'Plataformas',
      'Aventura',
      'Indie',
      'Género nuevo',
    ]);
    expect(result.details).toEqual({
      platforms: ['PC', 'Nintendo Switch'],
      gameModes: ['Un jugador'],
      trailerUrl: 'https://www.youtube.com/watch?v=Y2amTl5lBYM',
    });
  });

  it('separa desarrolladora y distribuidora', () => {
    expect(result.credits.map((c) => `${c.name}:${c.role}`)).toEqual([
      'Team Cherry:DEVELOPER',
      'Team Cherry:PUBLISHER',
      'Otra:PUBLISHER',
    ]);
    expect(result.credits[0]).toMatchObject({
      kind: 'COMPANY',
      ref: igdbRef('company', 7263),
      imageUrl: 'https://images.igdb.com/igdb/image/upload/t_logo_med/lg1.jpg',
    });
  });

  it('tolera un juego sin casi datos', () => {
    const sparse = mapGame({ id: 1, name: 'X' });
    expect(sparse).toMatchObject({
      synopsis: null,
      releaseDate: null,
      coverUrl: null,
      details: { platforms: [], gameModes: [], trailerUrl: null },
      credits: [],
    });
  });

  it('pasa la validación de la API', () => {
    expect(createMediaSchema.safeParse(withoutRelations(result)).success).toBe(
      true,
    );
  });
});

describe('otros', () => {
  it('convierte fechas Unix en UTC', () => {
    expect(releaseDate(1487894400)).toBe('2017-02-24');
    expect(releaseDate(undefined)).toBeNull();
  });

  it('escapa comillas y barras en la búsqueda', () => {
    expect(quote('dark souls')).toBe('"dark souls"');
    expect(quote('a"; fields *; where id = 1;')).toBe(
      '"a\\"; fields *; where id = 1;"',
    );
    expect(quote('a\\')).toBe('"a\\\\"');
  });

  it('resume los resultados de búsqueda', () => {
    expect(
      mapSearchHit({
        id: 14593,
        name: 'Hollow Knight',
        first_release_date: 1487894400,
        cover: { image_id: 'cobfzp' },
        platforms: [{ id: 6, name: 'PC (Microsoft Windows)' }],
        involved_companies: game.involved_companies,
      }),
    ).toEqual({
      igdbId: 14593,
      title: 'Hollow Knight',
      developer: 'Team Cherry',
      year: 2017,
      platforms: ['PC'],
      overview: null,
      coverUrl:
        'https://images.igdb.com/igdb/image/upload/t_cover_small_2x/cobfzp.jpg',
    });
  });
});
