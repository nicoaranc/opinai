// Subconjunto de las respuestas de la API pública de Deezer
// (https://developers.deezer.com/api)

export interface DeezerArtist {
  id: number;
  name: string;
  picture_medium?: string;
  role?: string; // en `contributors`: "Main", "Featured"
}

export interface DeezerAlbum {
  id: number;
  title: string;
  upc?: string;
  cover_medium: string;
  cover_big: string;
  release_date?: string; // "1997-06-17"
  record_type?: string; // "album", "ep", "single", "compile"
  label?: string;
  explicit_lyrics?: boolean;
  nb_tracks?: number;
  genres?: { data: { id: number; name: string }[] };
  contributors?: DeezerArtist[];
  artist: DeezerArtist;
}

// Canción tal como aparece en /album/{id}/tracks
export interface DeezerAlbumTrack {
  id: number;
  title: string;
  isrc?: string;
  duration: number; // segundos
  track_position: number;
  disk_number: number;
  explicit_lyrics: boolean;
  artist: DeezerArtist;
}

// Canción tal como la devuelve /track/{id}
export interface DeezerTrack extends DeezerAlbumTrack {
  release_date?: string;
  contributors?: DeezerArtist[];
  album: Pick<DeezerAlbum, 'id' | 'title' | 'cover_medium' | 'cover_big'>;
}

export interface DeezerList<T> {
  data: T[];
  total: number;
  next?: string;
}

// Resultado de /search/album
export interface DeezerAlbumHit {
  id: number;
  title: string;
  cover_medium: string;
  nb_tracks: number;
  record_type: string;
  explicit_lyrics: boolean;
  artist: DeezerArtist;
}

// Resultado de /search/track
export interface DeezerTrackHit {
  id: number;
  title: string;
  duration: number;
  explicit_lyrics: boolean;
  artist: DeezerArtist;
  album: { id: number; title: string; cover_medium: string };
}

// Deezer responde 200 con este cuerpo cuando algo falla
export interface DeezerErrorBody {
  error: { type: string; message: string; code: number };
}
