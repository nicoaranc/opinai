import { createMediaSchema } from '../../media/media.schemas.js';
import type { ImportedMedia } from '../imported-media.js';
import {
  deezerRef,
  mapAlbum,
  mapAlbumHit,
  mapTrack,
  mapTrackHit,
  trackPositions,
} from './deezer.mapper.js';
import type { DeezerAlbum, DeezerAlbumTrack } from './deezer.types.js';

const withoutRelations = ({
  credits: _credits,
  genres: _genres,
  externalIds: _externalIds,
  ...rest
}: ImportedMedia) => rest;

const radiohead = {
  id: 399,
  name: 'Radiohead',
  picture_medium:
    'https://cdn-images.dzcdn.net/images/artist/0d58/250x250-000000-80-0-0.jpg',
};

const album: DeezerAlbum = {
  id: 14879699,
  title: 'OK Computer',
  upc: '634904078164',
  cover_medium:
    'https://cdn-images.dzcdn.net/images/cover/05a1/250x250-000000-80-0-0.jpg',
  cover_big:
    'https://cdn-images.dzcdn.net/images/cover/05a1/500x500-000000-80-0-0.jpg',
  release_date: '1997-06-17',
  record_type: 'album',
  label: 'XL Recordings',
  genres: { data: [{ id: 85, name: 'Alternativo' }] },
  contributors: [
    { ...radiohead, role: 'Main' },
    { id: 7, name: 'Invitado', role: 'Featured' },
  ],
  artist: radiohead,
};

const track = (
  id: number,
  disc: number,
  position: number,
): DeezerAlbumTrack => ({
  id,
  title: `Canción ${id}`,
  isrc: `GBAYE97${id}`,
  duration: 287,
  track_position: position,
  disk_number: disc,
  explicit_lyrics: false,
  artist: radiohead,
});

describe('mapAlbum', () => {
  const result = mapAlbum(album);

  it('traduce los datos del álbum', () => {
    expect(result).toMatchObject({
      type: 'ALBUM',
      title: 'OK Computer',
      releaseDate: '1997-06-17',
      coverUrl: album.cover_big,
      genres: ['Alternativo'],
      details: { albumType: 'ALBUM', label: 'XL Recordings' },
    });
  });

  it('distingue artista principal y colaborador', () => {
    expect(result.credits.map((c) => `${c.name}:${c.role}`)).toEqual([
      'Radiohead:PRIMARY_ARTIST',
      'Invitado:FEATURED_ARTIST',
    ]);
    // Deezer no informa la foto de los colaboradores
    expect(result.credits[1].imageUrl).toBeNull();
  });

  it('identifica el álbum en Deezer y por su UPC', () => {
    expect(result.externalIds).toEqual([
      { provider: 'deezer', externalId: 'album:14879699' },
      { provider: 'upc', externalId: '634904078164' },
    ]);
  });

  it.each([
    ['ep', 'EP'],
    ['single', 'SINGLE'],
    ['compile', 'COMPILATION'],
    ['desconocido', 'ALBUM'],
  ])('record_type %s → %s', (recordType, albumType) => {
    expect(
      mapAlbum({ ...album, record_type: recordType }).details.albumType,
    ).toBe(albumType);
  });

  it('descarta imágenes genéricas y fechas vacías', () => {
    const sparse = mapAlbum({
      ...album,
      cover_big:
        'https://cdn-images.dzcdn.net/images/cover//500x500-000000-80-0-0.jpg',
      release_date: '0000-00-00',
    });
    expect(sparse.coverUrl).toBeNull();
    expect(sparse.releaseDate).toBeNull();
  });

  it('pasa la validación de la API', () => {
    expect(createMediaSchema.safeParse(withoutRelations(result)).success).toBe(
      true,
    );
  });
});

describe('mapTrack', () => {
  const result = mapTrack(track(138539971, 1, 1), album);

  it('hereda fecha, portada y géneros del álbum, sin preview', () => {
    expect(result).toMatchObject({
      type: 'TRACK',
      releaseDate: '1997-06-17',
      coverUrl: album.cover_big,
      genres: ['Alternativo'],
      details: { durationSeconds: 287, explicit: false },
    });
    expect(result.details).not.toHaveProperty('previewUrl');
  });

  it('se identifica por su ID de Deezer y su ISRC', () => {
    expect(result.externalIds).toEqual([
      deezerRef('track', 138539971),
      { provider: 'isrc', externalId: 'GBAYE97138539971' },
    ]);
  });

  it('pasa la validación de la API', () => {
    expect(createMediaSchema.safeParse(withoutRelations(result)).success).toBe(
      true,
    );
  });
});

describe('trackPositions', () => {
  it('respeta disco y pista', () => {
    expect(trackPositions([track(1, 1, 1), track(2, 2, 1)])).toEqual([
      { discNumber: 1, trackNumber: 1 },
      { discNumber: 2, trackNumber: 1 },
    ]);
  });

  it('evita posiciones repetidas o vacías', () => {
    const positions = trackPositions([
      track(1, 1, 1),
      track(2, 1, 1),
      track(3, 0, 0),
    ]);
    const keys = positions.map((p) => `${p.discNumber}:${p.trackNumber}`);
    expect(new Set(keys).size).toBe(3);
    expect(positions[2]).toEqual({ discNumber: 1, trackNumber: 3 });
  });
});

describe('resultados de búsqueda', () => {
  it('describe álbumes y canciones', () => {
    expect(
      mapAlbumHit({
        id: 1,
        title: 'OK Computer',
        cover_medium: album.cover_medium,
        nb_tracks: 12,
        record_type: 'album',
        explicit_lyrics: false,
        artist: radiohead,
      }).detail,
    ).toBe('Álbum · 12 canciones');
    expect(
      mapTrackHit({
        id: 2,
        title: 'Airbag',
        duration: 287,
        explicit_lyrics: false,
        artist: radiohead,
        album: {
          id: 1,
          title: 'OK Computer',
          cover_medium: album.cover_medium,
        },
      }),
    ).toMatchObject({ detail: '4:47', albumTitle: 'OK Computer' });
  });
});
