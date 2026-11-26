import type {
  CreatorKind,
  CreditRole,
  MediaType,
} from '../generated/prisma/client.js';

// Formato común al que cada integración (TMDB, Deezer, IGDB...) traduce sus
// respuestas. MediaImporter lo guarda en la base sin saber de dónde vino.

export interface ExternalRef {
  provider: string; // "tmdb", "imdb", "deezer"...
  externalId: string;
}

export interface ImportedCredit {
  ref: ExternalRef; // para no duplicar al creador entre importaciones
  name: string;
  kind: CreatorKind;
  imageUrl: string | null;
  role: CreditRole;
}

export interface ImportedMedia {
  type: MediaType;
  title: string;
  originalTitle: string | null;
  synopsis: string | null;
  releaseDate: string | null; // "AAAA-MM-DD"
  coverUrl: string | null;
  backdropUrl: string | null;
  language: string | null;
  country: string | null;
  genres: string[]; // nombres, p. ej. "Ciencia ficción"
  details: Record<string, unknown>;
  credits: ImportedCredit[];
  // El primero identifica la obra en su proveedor; los demás son extra (imdb)
  externalIds: [ExternalRef, ...ExternalRef[]];
}
