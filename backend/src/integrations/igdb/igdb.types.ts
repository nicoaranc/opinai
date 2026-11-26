// Subconjunto de las respuestas de IGDB (https://api-docs.igdb.com)

export interface IgdbImage {
  image_id: string;
}

export interface IgdbNamed {
  id: number;
  name: string;
}

export interface IgdbInvolvedCompany {
  developer: boolean;
  publisher: boolean;
  company: { id: number; name: string; logo?: IgdbImage };
}

export interface IgdbGame {
  id: number;
  name: string;
  summary?: string;
  first_release_date?: number; // segundos Unix
  cover?: IgdbImage;
  artworks?: IgdbImage[];
  screenshots?: IgdbImage[];
  genres?: IgdbNamed[];
  game_modes?: IgdbNamed[];
  platforms?: IgdbNamed[];
  involved_companies?: IgdbInvolvedCompany[];
  videos?: { video_id: string; name?: string }[]; // IDs de YouTube
}

export interface IgdbSearchHit {
  id: number;
  name: string;
  first_release_date?: number;
  summary?: string;
  cover?: IgdbImage;
  game_type?: { type: string };
  platforms?: IgdbNamed[];
  involved_companies?: IgdbInvolvedCompany[];
}
