import { Injectable } from '@nestjs/common';
import { MediaType } from '../../generated/prisma/client.js';
import { MediaImporter } from '../media-importer.service.js';
import { TMDB_LANGUAGE, TmdbClient } from './tmdb.client.js';
import {
  mapMovie,
  mapSearchResult,
  mapSeries,
  TMDB_PROVIDER,
  tmdbRef,
  type TmdbKind,
} from './tmdb.mapper.js';
import type { TmdbImportDto, TmdbSearchQuery } from './tmdb.schemas.js';
import type { TmdbMovie, TmdbSearchPage, TmdbSeries } from './tmdb.types.js';

const KIND: Record<TmdbImportDto['type'], TmdbKind> = {
  [MediaType.MOVIE]: 'movie',
  [MediaType.SERIES]: 'tv',
};

@Injectable()
export class TmdbService {
  constructor(
    private readonly tmdb: TmdbClient,
    private readonly importer: MediaImporter,
  ) {}

  // Busca en TMDB e indica cuáles ya están en el catálogo (`importedSlug`)
  async search({ type, q, page }: TmdbSearchQuery) {
    const kind = KIND[type];
    const result = await this.tmdb.get<TmdbSearchPage>(`/search/${kind}`, {
      query: q,
      page,
      language: TMDB_LANGUAGE,
      include_adult: 'false',
    });

    const items = result.results.map((r) => mapSearchResult(kind, r));
    const imported = await this.importer.findImported(
      TMDB_PROVIDER,
      items.map((i) => tmdbRef(kind, i.tmdbId).externalId),
    );
    return {
      items: items.map((item) => ({
        ...item,
        type,
        importedSlug:
          imported.get(tmdbRef(kind, item.tmdbId).externalId) ?? null,
      })),
      page: result.page,
      totalPages: Math.min(result.total_pages, 500), // TMDB no pasa de 500
      total: result.total_results,
    };
  }

  // Importa (o devuelve, si ya estaba) una película o serie
  async import({ type, tmdbId }: TmdbImportDto) {
    const kind = KIND[type];
    return this.importer.import(tmdbRef(kind, tmdbId), () =>
      this.fetchMapped(kind, tmdbId),
    );
  }

  private async fetchMapped(kind: TmdbKind, id: number) {
    if (kind === 'movie') {
      const movie = await this.tmdb.get<TmdbMovie>(`/movie/${id}`, {
        language: TMDB_LANGUAGE,
        append_to_response: 'credits,release_dates,videos',
        include_video_language: 'es,en',
      });
      return mapMovie(
        movie,
        await this.englishOverview(kind, id, movie.overview),
      );
    }
    const series = await this.tmdb.get<TmdbSeries>(`/tv/${id}`, {
      language: TMDB_LANGUAGE,
      append_to_response: 'content_ratings,videos,external_ids',
      include_video_language: 'es,en',
    });
    return mapSeries(
      series,
      await this.englishOverview(kind, id, series.overview),
    );
  }

  // Si no hay sinopsis en español, se pide la versión en inglés
  private async englishOverview(
    kind: TmdbKind,
    id: number,
    overview: string | null,
  ): Promise<string | null> {
    if (overview?.trim()) return null;
    const english = await this.tmdb.get<{ overview: string | null }>(
      `/${kind}/${id}`,
      { language: 'en-US' },
    );
    return english.overview;
  }
}
