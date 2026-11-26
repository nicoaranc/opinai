import { Injectable, NotFoundException } from '@nestjs/common';
import { MediaType } from '../../generated/prisma/client.js';
import { MediaImporter } from '../media-importer.service.js';
import { IgdbClient } from './igdb.client.js';
import {
  IGDB_PROVIDER,
  igdbRef,
  IMPORTABLE_GAME_TYPES,
  mapGame,
  mapSearchHit,
  quote,
} from './igdb.mapper.js';
import type { IgdbImportDto, IgdbSearchQuery } from './igdb.schemas.js';
import type { IgdbGame, IgdbSearchHit } from './igdb.types.js';

const PAGE_SIZE = 20;
const MAX_PAGES = 50;

const SEARCH_FIELDS = [
  'name',
  'first_release_date',
  'summary',
  'cover.image_id',
  'platforms.name',
  'involved_companies.developer',
  'involved_companies.company.name',
].join(',');

const DETAIL_FIELDS = [
  'name',
  'summary',
  'first_release_date',
  'cover.image_id',
  'artworks.image_id',
  'screenshots.image_id',
  'genres.name',
  'game_modes.name',
  'platforms.name',
  'involved_companies.developer',
  'involved_companies.publisher',
  'involved_companies.company.name',
  'involved_companies.company.logo.image_id',
  'videos.video_id',
  'videos.name',
].join(',');

@Injectable()
export class IgdbService {
  constructor(
    private readonly igdb: IgdbClient,
    private readonly importer: MediaImporter,
  ) {}

  // Busca juegos e indica cuáles ya están en el catálogo
  async search({ q, page }: IgdbSearchQuery) {
    const { rows, total } = await this.igdb.query<IgdbSearchHit>(
      'games',
      [
        `search ${quote(q)};`,
        `fields ${SEARCH_FIELDS};`,
        `where game_type = (${IMPORTABLE_GAME_TYPES.join(',')});`,
        `limit ${PAGE_SIZE};`,
        `offset ${(page - 1) * PAGE_SIZE};`,
      ].join(' '),
    );

    const items = rows.map(mapSearchHit);
    const imported = await this.importer.findImported(
      IGDB_PROVIDER,
      items.map((i) => igdbRef('game', i.igdbId).externalId),
    );
    return {
      items: items.map((item) => ({
        ...item,
        type: MediaType.GAME,
        importedSlug:
          imported.get(igdbRef('game', item.igdbId).externalId) ?? null,
      })),
      page,
      totalPages: Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES),
      total,
    };
  }

  // Importa (o devuelve, si ya estaba) un juego
  import({ igdbId }: IgdbImportDto) {
    return this.importer.import(igdbRef('game', igdbId), async () => {
      const { rows } = await this.igdb.query<IgdbGame>(
        'games',
        `fields ${DETAIL_FIELDS}; where id = ${igdbId};`,
      );
      // IGDB responde [] (no 404) cuando el ID no existe
      if (!rows[0]) throw new NotFoundException('No existe en IGDB');
      return mapGame(rows[0]);
    });
  }
}
