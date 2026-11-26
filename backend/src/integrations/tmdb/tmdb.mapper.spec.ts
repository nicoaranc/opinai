import { createMediaSchema } from '../../media/media.schemas.js';
import {
  mapMovie,
  mapSearchResult,
  mapSeries,
  pickTrailer,
  tmdbRef,
} from './tmdb.mapper.js';
import type { ImportedMedia } from '../imported-media.js';
import type { TmdbMovie, TmdbSeries } from './tmdb.types.js';

// Lo que MediaImporter valida: sin créditos, géneros ni IDs externos, que
// se resuelven aparte
const withoutRelations = ({
  credits: _credits,
  genres: _genres,
  externalIds: _externalIds,
  ...rest
}: ImportedMedia) => rest;

const movie: TmdbMovie = {
  id: 496243,
  imdb_id: 'tt6751668',
  title: 'Parásitos',
  original_title: '기생충',
  overview: 'Tanto Gi Taek como su familia están sin trabajo.',
  release_date: '2019-05-30',
  poster_path: '/abc.jpg',
  backdrop_path: '/bg.jpg',
  original_language: 'ko',
  origin_country: ['KR'],
  runtime: 132,
  genres: [
    { id: 35, name: 'Comedia' },
    { id: 18, name: 'Drama' },
  ],
  credits: {
    crew: [
      {
        id: 21684,
        name: 'Bong Joon-ho',
        job: 'Director',
        department: 'Directing',
        profile_path: '/b.jpg',
      },
      {
        id: 21684,
        name: 'Bong Joon-ho',
        job: 'Screenplay',
        department: 'Writing',
        profile_path: '/b.jpg',
      },
      {
        id: 2,
        name: 'Han Jin-won',
        job: 'Screenplay',
        department: 'Writing',
        profile_path: null,
      },
      {
        id: 3,
        name: 'Kim Dae-hwan',
        job: 'Adaptation',
        department: 'Writing',
        profile_path: null,
      },
      {
        id: 4,
        name: 'Alguien',
        job: 'Editor',
        department: 'Editing',
        profile_path: null,
      },
    ],
  },
  release_dates: {
    results: [
      { iso_3166_1: 'CL', release_dates: [{ certification: '' }] },
      { iso_3166_1: 'US', release_dates: [{ certification: 'R' }] },
    ],
  },
  videos: {
    results: [
      { site: 'YouTube', type: 'Teaser', key: 'teaser', iso_639_1: 'es' },
      {
        site: 'YouTube',
        type: 'Trailer',
        key: 'en1',
        iso_639_1: 'en',
        official: true,
      },
      { site: 'YouTube', type: 'Trailer', key: 'es1', iso_639_1: 'es' },
    ],
  },
};

const series: TmdbSeries = {
  id: 1396,
  name: 'Breaking Bad',
  original_name: 'Breaking Bad',
  overview: '',
  first_air_date: '2008-01-20',
  last_air_date: '2013-09-29',
  status: 'Ended',
  number_of_seasons: 5,
  number_of_episodes: 62,
  poster_path: null,
  backdrop_path: null,
  original_language: 'en',
  origin_country: ['US'],
  networks: [{ name: 'AMC' }],
  genres: [{ id: 18, name: 'Drama' }],
  created_by: [{ id: 66633, name: 'Vince Gilligan', profile_path: null }],
  content_ratings: { results: [{ iso_3166_1: 'US', rating: 'TV-MA' }] },
  external_ids: { imdb_id: 'tt0903747' },
};

describe('mapMovie', () => {
  const result = mapMovie(movie);

  it('traduce los campos comunes y las imágenes', () => {
    expect(result).toMatchObject({
      type: 'MOVIE',
      title: 'Parásitos',
      originalTitle: '기생충',
      releaseDate: '2019-05-30',
      coverUrl: 'https://image.tmdb.org/t/p/w500/abc.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/w1280/bg.jpg',
      language: 'ko',
      country: 'KR',
      genres: ['Comedia', 'Drama'],
    });
  });

  it('usa la clasificación de EE. UU. si Chile no tiene y prefiere el tráiler en español', () => {
    expect(result.details).toEqual({
      runtimeMinutes: 132,
      ageRating: 'R',
      trailerUrl: 'https://www.youtube.com/watch?v=es1',
    });
  });

  it('toma directores y guionistas sin repetir ni incluir otros oficios', () => {
    expect(result.credits.map((c) => `${c.name}:${c.role}`)).toEqual([
      'Bong Joon-ho:DIRECTOR',
      'Bong Joon-ho:WRITER',
      'Han Jin-won:WRITER',
    ]);
    expect(result.credits[0].ref).toEqual({
      provider: 'tmdb',
      externalId: 'person:21684',
    });
  });

  it('identifica la obra en TMDB e IMDb', () => {
    expect(result.externalIds).toEqual([
      { provider: 'tmdb', externalId: 'movie:496243' },
      { provider: 'imdb', externalId: 'tt6751668' },
    ]);
  });

  it('pasa la validación de la API', () => {
    expect(createMediaSchema.safeParse(withoutRelations(result)).success).toBe(
      true,
    );
  });

  it('usa la sinopsis de respaldo y tolera fechas vacías', () => {
    const sparse = mapMovie(
      {
        ...movie,
        overview: '',
        release_date: '',
        runtime: 0,
        original_title: 'Parásitos',
      },
      'English overview',
    );
    expect(sparse.synopsis).toBe('English overview');
    expect(sparse.releaseDate).toBeNull();
    expect(sparse.originalTitle).toBeNull();
    expect(sparse.details.runtimeMinutes).toBeNull();
  });
});

describe('mapSeries', () => {
  const result = mapSeries(series, 'A chemistry teacher...');

  it('traduce estado, temporadas, cadena y creadores', () => {
    expect(result).toMatchObject({
      type: 'SERIES',
      title: 'Breaking Bad',
      originalTitle: null,
      synopsis: 'A chemistry teacher...',
      coverUrl: null,
      details: {
        status: 'ENDED',
        seasonsCount: 5,
        episodesCount: 62,
        endDate: '2013-09-29',
        network: 'AMC',
        ageRating: 'TV-MA',
        trailerUrl: null,
      },
    });
    expect(result.credits.map((c) => c.role)).toEqual(['SHOWRUNNER']);
    expect(result.externalIds[0]).toEqual(tmdbRef('tv', 1396));
  });

  it('no pone fecha de fin a una serie en emisión', () => {
    expect(
      mapSeries({ ...series, status: 'Returning Series' }).details,
    ).toMatchObject({
      status: 'RETURNING',
      endDate: null,
    });
  });

  it('pasa la validación de la API', () => {
    expect(createMediaSchema.safeParse(withoutRelations(result)).success).toBe(
      true,
    );
  });
});

describe('otros', () => {
  it('distingue IDs de películas y series', () => {
    expect(tmdbRef('movie', 1396)).not.toEqual(tmdbRef('tv', 1396));
  });

  it('no inventa tráiler si no hay', () => {
    expect(
      pickTrailer([
        { site: 'Vimeo', type: 'Trailer', key: 'x', iso_639_1: 'es' },
      ]),
    ).toBeNull();
  });

  it('mapea resultados de búsqueda de series', () => {
    expect(
      mapSearchResult('tv', {
        id: 1396,
        name: 'Breaking Bad',
        original_name: 'Breaking Bad',
        first_air_date: '2008-01-20',
        overview: 'x',
        poster_path: '/p.jpg',
      }),
    ).toEqual({
      tmdbId: 1396,
      title: 'Breaking Bad',
      originalTitle: null,
      year: 2008,
      overview: 'x',
      posterUrl: 'https://image.tmdb.org/t/p/w185/p.jpg',
    });
  });
});
