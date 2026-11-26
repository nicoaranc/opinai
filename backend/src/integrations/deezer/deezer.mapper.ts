import {
  AlbumType,
  CreatorKind,
  CreditRole,
  MediaType,
} from '../../generated/prisma/client.js';
import type {
  ExternalRef,
  ImportedCredit,
  ImportedMedia,
} from '../imported-media.js';
import type {
  DeezerAlbum,
  DeezerAlbumHit,
  DeezerAlbumTrack,
  DeezerArtist,
  DeezerTrackHit,
} from './deezer.types.js';

// Traduce las respuestas de Deezer al formato común (ImportedMedia).
// Funciones puras: se prueban sin red.

export const DEEZER_PROVIDER = 'deezer';
export const ISRC_PROVIDER = 'isrc'; // identifica la grabación de una canción

export const deezerRef = (
  kind: 'album' | 'track' | 'artist',
  id: number,
): ExternalRef => ({ provider: DEEZER_PROVIDER, externalId: `${kind}:${id}` });

const RECORD_TYPES: Record<string, AlbumType> = {
  album: AlbumType.ALBUM,
  ep: AlbumType.EP,
  single: AlbumType.SINGLE,
  compile: AlbumType.COMPILATION,
};

const clip = (text: string | null | undefined, max: number) => {
  const value = text?.trim();
  return value ? value.slice(0, max) : null;
};
const date = (value: string | null | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000')
    ? value
    : null;

// Deezer devuelve una imagen genérica (sin hash) cuando no hay foto
const image = (url: string | null | undefined) =>
  url && !/\/images\/(artist|cover)\/\//.test(url) ? url : null;

// Deezer no distingue personas de grupos: se guardan como PERSON y un ADMIN
// puede corregirlo (p. ej. Radiohead → GROUP)
function artistCredit(artist: DeezerArtist, role: CreditRole): ImportedCredit {
  return {
    ref: deezerRef('artist', artist.id),
    name: artist.name,
    kind: CreatorKind.PERSON,
    imageUrl: image(artist.picture_medium),
    role,
  };
}

// Artista principal y, si los hay, colaboradores
function albumCredits(album: DeezerAlbum): ImportedCredit[] {
  const contributors = album.contributors?.length
    ? album.contributors
    : [album.artist];
  return contributors.map((c) =>
    artistCredit(
      c,
      c.role === 'Featured'
        ? CreditRole.FEATURED_ARTIST
        : CreditRole.PRIMARY_ARTIST,
    ),
  );
}

export function mapAlbum(album: DeezerAlbum): ImportedMedia {
  return {
    type: MediaType.ALBUM,
    title: clip(album.title, 300) ?? '',
    originalTitle: null,
    synopsis: null,
    releaseDate: date(album.release_date),
    // 500×500; el front cambia el tamaño en la URL
    coverUrl: image(album.cover_big),
    backdropUrl: null,
    language: null,
    country: null,
    genres: (album.genres?.data ?? []).map((g) => g.name),
    details: {
      albumType: RECORD_TYPES[album.record_type ?? ''] ?? AlbumType.ALBUM,
      label: clip(album.label, 150),
    },
    credits: albumCredits(album),
    externalIds: [
      deezerRef('album', album.id),
      ...(album.upc ? [{ provider: 'upc', externalId: album.upc }] : []),
    ],
  };
}

// Una canción del álbum. Hereda la fecha, la portada y los géneros del álbum.
// La preview de 30 s no se guarda: Deezer firma esas URLs y caducan.
export function mapTrack(
  track: DeezerAlbumTrack,
  album: Pick<DeezerAlbum, 'cover_big' | 'release_date' | 'genres'>,
): ImportedMedia {
  return {
    type: MediaType.TRACK,
    title: clip(track.title, 300) ?? '',
    originalTitle: null,
    synopsis: null,
    releaseDate: date(album.release_date),
    coverUrl: image(album.cover_big),
    backdropUrl: null,
    language: null,
    country: null,
    genres: (album.genres?.data ?? []).map((g) => g.name),
    details: {
      durationSeconds: track.duration > 0 ? track.duration : null,
      explicit: track.explicit_lyrics,
    },
    credits: [artistCredit(track.artist, CreditRole.PRIMARY_ARTIST)],
    externalIds: [
      deezerRef('track', track.id),
      ...(track.isrc
        ? [{ provider: ISRC_PROVIDER, externalId: track.isrc }]
        : []),
    ],
  };
}

// Posiciones de las canciones: (disco, pista) únicos. Si Deezer repite o
// falta alguna, se numera por orden de llegada.
export function trackPositions(tracks: DeezerAlbumTrack[]) {
  const used = new Set<string>();
  return tracks.map((t, index) => {
    let discNumber = t.disk_number > 0 ? t.disk_number : 1;
    let trackNumber = t.track_position > 0 ? t.track_position : index + 1;
    if (used.has(`${discNumber}:${trackNumber}`)) {
      discNumber = 1;
      trackNumber = 1000 + index; // fuera de rango normal, pero único
    }
    used.add(`${discNumber}:${trackNumber}`);
    return { discNumber, trackNumber };
  });
}

const ALBUM_TYPE_LABELS: Record<string, string> = {
  album: 'Álbum',
  ep: 'EP',
  single: 'Sencillo',
  compile: 'Recopilatorio',
};

export function mapAlbumHit(hit: DeezerAlbumHit) {
  return {
    deezerId: hit.id,
    title: hit.title,
    artist: hit.artist.name,
    albumTitle: null,
    // "Álbum · 12 canciones"
    detail: [
      ALBUM_TYPE_LABELS[hit.record_type] ?? 'Álbum',
      `${hit.nb_tracks} ${hit.nb_tracks === 1 ? 'canción' : 'canciones'}`,
    ].join(' · '),
    coverUrl: image(hit.cover_medium),
    explicit: hit.explicit_lyrics,
  };
}

export function mapTrackHit(hit: DeezerTrackHit) {
  const minutes = Math.floor(hit.duration / 60);
  const seconds = String(hit.duration % 60).padStart(2, '0');
  return {
    deezerId: hit.id,
    title: hit.title,
    artist: hit.artist.name,
    albumTitle: hit.album.title,
    detail: `${minutes}:${seconds}`,
    coverUrl: image(hit.album.cover_medium),
    explicit: hit.explicit_lyrics,
  };
}
