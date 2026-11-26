import { Injectable, Logger } from '@nestjs/common';
import { MediaType } from '../../generated/prisma/client.js';
import { MediaService } from '../../media/media.service.js';
import { MediaImporter } from '../media-importer.service.js';
import { DeezerClient } from './deezer.client.js';
import {
  DEEZER_PROVIDER,
  deezerRef,
  ISRC_PROVIDER,
  mapAlbum,
  mapAlbumHit,
  mapTrack,
  mapTrackHit,
  trackPositions,
} from './deezer.mapper.js';
import type { DeezerImportDto, DeezerSearchQuery } from './deezer.schemas.js';
import type {
  DeezerAlbum,
  DeezerAlbumHit,
  DeezerAlbumTrack,
  DeezerList,
  DeezerTrack,
  DeezerTrackHit,
} from './deezer.types.js';

const PAGE_SIZE = 20;
// Deezer no devuelve más allá de unos 1.000 resultados por búsqueda
const MAX_PAGES = 50;

@Injectable()
export class DeezerService {
  private readonly logger = new Logger(DeezerService.name);

  constructor(
    private readonly deezer: DeezerClient,
    private readonly importer: MediaImporter,
    private readonly media: MediaService,
  ) {}

  // Busca álbumes o canciones e indica cuáles ya están en el catálogo
  async search({ type, q, page }: DeezerSearchQuery) {
    const params = { q, index: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE };
    if (type === MediaType.ALBUM) {
      const result = await this.deezer.get<DeezerList<DeezerAlbumHit>>(
        '/search/album',
        params,
      );
      return this.toPage(
        type,
        'album',
        result.data.map(mapAlbumHit),
        result.total,
        page,
      );
    }
    const result = await this.deezer.get<DeezerList<DeezerTrackHit>>(
      '/search/track',
      params,
    );
    return this.toPage(
      type,
      'track',
      result.data.map(mapTrackHit),
      result.total,
      page,
    );
  }

  // Importa (o devuelve, si ya estaba) un álbum o una canción
  async import({ type, deezerId }: DeezerImportDto) {
    return type === MediaType.ALBUM
      ? this.importAlbum(deezerId)
      : this.importTrack(deezerId);
  }

  // Importa el álbum, sus canciones y la lista de canciones
  private async importAlbum(albumId: number) {
    let loaded: { album: DeezerAlbum; tracks: DeezerAlbumTrack[] } | undefined;
    const result = await this.importer.import(
      deezerRef('album', albumId),
      async () => {
        const [album, tracks] = await Promise.all([
          this.deezer.get<DeezerAlbum>(`/album/${albumId}`),
          this.deezer.get<DeezerList<DeezerAlbumTrack>>(
            `/album/${albumId}/tracks`,
            {
              limit: 500,
            },
          ),
        ]);
        loaded = { album, tracks: tracks.data };
        return mapAlbum(album);
      },
    );

    // Si el álbum ya existía, se deja como estaba
    if (!result.created || !loaded) return result;

    const { album, tracks } = loaded;
    const positions = trackPositions(tracks);
    const entries: {
      trackId: string;
      discNumber: number;
      trackNumber: number;
    }[] = [];
    const added = new Set<string>();
    for (const [index, track] of tracks.entries()) {
      try {
        const trackId = await this.ensureTrack(track, album);
        // La misma grabación dos veces en un álbum: se lista una sola vez
        if (added.has(trackId)) continue;
        added.add(trackId);
        entries.push({ trackId, ...positions[index] });
      } catch (error) {
        // Una canción con datos inválidos no impide importar el resto
        this.logger.warn(
          `No se pudo importar la canción ${track.id} del álbum ${albumId}: ${String(error)}`,
        );
      }
    }

    const media = await this.media.setTracks(result.media.id, {
      tracks: entries,
    });
    return { created: true, media };
  }

  // Busca la canción por su ID de Deezer o por su ISRC (la misma grabación en
  // otro álbum ya importado) y la crea si no existe. Devuelve su ID.
  private async ensureTrack(
    track: DeezerAlbumTrack,
    album: DeezerAlbum,
  ): Promise<string> {
    if (track.isrc) {
      const byIsrc = await this.importer.findMediaId({
        provider: ISRC_PROVIDER,
        externalId: track.isrc,
      });
      if (byIsrc) return byIsrc;
    }
    const { media } = await this.importer.import(
      deezerRef('track', track.id),
      () => Promise.resolve(mapTrack(track, album)),
    );
    return media.id;
  }

  // Una canción se importa con su álbum completo, para que tenga su lista de
  // canciones y "aparece en". Si no estuviera en él, se importa sola.
  private async importTrack(trackId: number) {
    const ref = deezerRef('track', trackId);
    const existing = await this.importer.findMediaId(ref);
    if (existing) {
      return { created: false, media: await this.media.findOne(existing) };
    }

    const track = await this.deezer.get<DeezerTrack>(`/track/${trackId}`);
    if (track.isrc) {
      const byIsrc = await this.importer.findMediaId({
        provider: ISRC_PROVIDER,
        externalId: track.isrc,
      });
      if (byIsrc)
        return { created: false, media: await this.media.findOne(byIsrc) };
    }

    await this.importAlbum(track.album.id);
    const fromAlbum =
      (await this.importer.findMediaId(ref)) ??
      (track.isrc
        ? await this.importer.findMediaId({
            provider: ISRC_PROVIDER,
            externalId: track.isrc,
          })
        : null);
    if (fromAlbum) {
      return { created: true, media: await this.media.findOne(fromAlbum) };
    }

    // El álbum ya existía sin esta canción (p. ej. el del seed, con solo
    // algunas): se importa sola y se agrega a ese álbum en su posición
    const result = await this.importer.import(ref, () =>
      Promise.resolve(
        mapTrack(track, {
          cover_big: track.album.cover_big,
          release_date: track.release_date,
        }),
      ),
    );
    const albumMediaId = await this.importer.findMediaId(
      deezerRef('album', track.album.id),
    );
    if (albumMediaId) {
      const [position] = trackPositions([track]);
      await this.media.addTrackToAlbum(albumMediaId, result.media.id, position);
      return { ...result, media: await this.media.findOne(result.media.id) };
    }
    return result;
  }

  private async toPage<T extends { deezerId: number }>(
    type: DeezerSearchQuery['type'],
    kind: 'album' | 'track',
    items: T[],
    total: number,
    page: number,
  ) {
    const imported = await this.importer.findImported(
      DEEZER_PROVIDER,
      items.map((i) => deezerRef(kind, i.deezerId).externalId),
    );
    return {
      items: items.map((item) => ({
        ...item,
        type,
        importedSlug:
          imported.get(deezerRef(kind, item.deezerId).externalId) ?? null,
      })),
      page,
      totalPages: Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES),
      total,
    };
  }
}
