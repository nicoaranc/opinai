import {
  CreatorKind,
  CreditRole,
  MediaType,
} from '../../generated/prisma/client.js';
import type { ImportedCredit, ImportedMedia } from '../imported-media.js';
import type {
  IgdbGame,
  IgdbInvolvedCompany,
  IgdbNamed,
  IgdbSearchHit,
} from './igdb.types.js';

// Traduce las respuestas de IGDB al formato común (ImportedMedia).
// Funciones puras: se prueban sin red.

export const IGDB_PROVIDER = 'igdb';

export const igdbRef = (kind: 'game' | 'company', id: number) => ({
  provider: IGDB_PROVIDER,
  externalId: `${kind}:${id}`,
});

// Tipos de juego que se buscan e importan: se excluyen mods, DLC sueltos,
// paquetes, episodios, temporadas, forks y actualizaciones
// (0 principal, 2 expansión, 4 expansión independiente, 8 remake,
// 9 remaster, 10 juego ampliado, 11 port)
export const IMPORTABLE_GAME_TYPES = [0, 2, 4, 8, 9, 10, 11];

const IMAGE_BASE = 'https://images.igdb.com/igdb/image/upload';
// Se guarda la portada en t_cover_big_2x (528×748); el front cambia el tamaño
export const igdbImage = (
  imageId: string | undefined,
  size: 't_cover_big_2x' | 't_cover_small_2x' | 't_1080p' | 't_logo_med',
): string | null => (imageId ? `${IMAGE_BASE}/${size}/${imageId}.jpg` : null);

// IGDB da los nombres en inglés: se traducen los habituales; el resto se
// conserva tal cual. "Adventure" → "Aventura" coincide con el género de TMDB.
const GENRES: Record<string, string> = {
  Adventure: 'Aventura',
  Arcade: 'Arcade',
  'Card & Board Game': 'Cartas y tablero',
  Fighting: 'Lucha',
  "Hack and slash/Beat 'em up": 'Hack and slash',
  Indie: 'Indie',
  MOBA: 'MOBA',
  Music: 'Musical',
  Pinball: 'Pinball',
  Platform: 'Plataformas',
  'Point-and-click': 'Point and click',
  Puzzle: 'Puzles',
  'Quiz/Trivia': 'Preguntas',
  Racing: 'Carreras',
  'Real Time Strategy (RTS)': 'Estrategia en tiempo real',
  'Role-playing (RPG)': 'Rol',
  Shooter: 'Disparos',
  Simulator: 'Simulación',
  Sport: 'Deportes',
  Strategy: 'Estrategia',
  Tactical: 'Táctica',
  'Turn-based strategy (TBS)': 'Estrategia por turnos',
  'Visual Novel': 'Novela visual',
};

const GAME_MODES: Record<string, string> = {
  'Single player': 'Un jugador',
  Multiplayer: 'Multijugador',
  'Co-operative': 'Cooperativo',
  'Split screen': 'Pantalla dividida',
  'Massively Multiplayer Online (MMO)': 'MMO',
  'Battle Royale': 'Battle royale',
};

const PLATFORMS: Record<string, string> = {
  'PC (Microsoft Windows)': 'PC',
};

const translate = (map: Record<string, string>, items: IgdbNamed[] = []) =>
  [...new Set(items.map((i) => map[i.name] ?? i.name))].map((n) =>
    n.slice(0, 50),
  );

const clip = (text: string | null | undefined, max: number) => {
  const value = text?.trim();
  return value ? value.slice(0, max) : null;
};

// Segundos Unix → "AAAA-MM-DD" (UTC)
export function releaseDate(seconds: number | undefined): string | null {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function companyCredits(
  companies: IgdbInvolvedCompany[] = [],
): ImportedCredit[] {
  const credits: ImportedCredit[] = [];
  for (const role of [CreditRole.DEVELOPER, CreditRole.PUBLISHER]) {
    for (const ic of companies) {
      if (role === CreditRole.DEVELOPER ? !ic.developer : !ic.publisher)
        continue;
      credits.push({
        ref: igdbRef('company', ic.company.id),
        name: ic.company.name,
        kind: CreatorKind.COMPANY,
        imageUrl: igdbImage(ic.company.logo?.image_id, 't_logo_med'),
        role,
      });
    }
  }
  return credits;
}

export function mapGame(game: IgdbGame): ImportedMedia {
  const background = game.artworks?.[0] ?? game.screenshots?.[0];
  const trailer =
    game.videos?.find((v) => /trailer/i.test(v.name ?? '')) ?? game.videos?.[0];
  return {
    type: MediaType.GAME,
    title: clip(game.name, 300) ?? '',
    originalTitle: null,
    // IGDB solo tiene sinopsis en inglés
    synopsis: clip(game.summary, 10_000),
    releaseDate: releaseDate(game.first_release_date),
    coverUrl: igdbImage(game.cover?.image_id, 't_cover_big_2x'),
    backdropUrl: igdbImage(background?.image_id, 't_1080p'),
    language: null,
    country: null,
    genres: translate(GENRES, game.genres),
    details: {
      platforms: translate(PLATFORMS, game.platforms).slice(0, 30),
      gameModes: translate(GAME_MODES, game.game_modes).slice(0, 30),
      trailerUrl: trailer
        ? `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.video_id)}`
        : null,
    },
    credits: companyCredits(game.involved_companies),
    externalIds: [igdbRef('game', game.id)],
  };
}

export function mapSearchHit(hit: IgdbSearchHit) {
  const developer = hit.involved_companies?.find((c) => c.developer)?.company
    .name;
  const year = hit.first_release_date
    ? new Date(hit.first_release_date * 1000).getUTCFullYear()
    : null;
  return {
    igdbId: hit.id,
    title: hit.name,
    developer: developer ?? null,
    year,
    platforms: translate(PLATFORMS, hit.platforms).slice(0, 4),
    overview: clip(hit.summary, 300),
    coverUrl: igdbImage(hit.cover?.image_id, 't_cover_small_2x'),
  };
}

// Escapa un texto para usarlo entre comillas en una consulta de IGDB
// (evita que comillas o barras alteren la consulta)
export function quote(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
