import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { pageArgs, toPage } from '../common/pagination.js';
import { whereIdOrSlug } from '../common/params.js';
import {
  creatorSummarySelect,
  genreSelect,
  mediaSummarySelect,
} from '../common/selects.js';
import { uniqueSlug } from '../common/slug.js';
import { MediaType, type Prisma } from '../generated/prisma/client.js';
import type { ExternalRef } from '../integrations/imported-media.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ALLOWED_ROLES,
  DETAILS_SCHEMAS,
  type CreateMediaDto,
  type ListMediaQuery,
  type SetTracksDto,
  type UpdateMediaDto,
} from './media.schemas.js';

// Relación 1:1 de detalles que corresponde a cada tipo
const DETAILS_RELATION = {
  MOVIE: 'movie',
  SERIES: 'series',
  ALBUM: 'album',
  TRACK: 'track',
  GAME: 'game',
} as const satisfies Record<MediaType, string>;

const ORDER_BY: Record<
  ListMediaQuery['sort'],
  Prisma.MediaOrderByWithRelationInput[]
> = {
  recent: [{ releaseDate: { sort: 'desc', nulls: 'last' } }, { title: 'asc' }],
  oldest: [{ releaseDate: { sort: 'asc', nulls: 'last' } }, { title: 'asc' }],
  title: [{ title: 'asc' }],
  rating: [
    { ratingAvg: { sort: 'desc', nulls: 'last' } },
    { ratingCount: 'desc' },
    { title: 'asc' },
  ],
  popular: [{ reviewCount: 'desc' }, { title: 'asc' }],
  added: [{ createdAt: 'desc' }],
};

const omitMediaId = { omit: { mediaId: true } } as const;

const mediaDetailSelect = {
  ...mediaSummarySelect,
  synopsis: true,
  backdropUrl: true,
  language: true,
  country: true,
  createdAt: true,
  updatedAt: true,
  movie: omitMediaId,
  series: omitMediaId,
  album: omitMediaId,
  track: omitMediaId,
  game: omitMediaId,
  genres: { select: genreSelect, orderBy: { name: 'asc' } },
  credits: {
    orderBy: [{ role: 'asc' }, { position: 'asc' }],
    select: {
      role: true,
      position: true,
      creator: { select: creatorSummarySelect },
    },
  },
  // Si es un álbum: sus canciones
  albumTracks: {
    orderBy: [{ discNumber: 'asc' }, { trackNumber: 'asc' }],
    select: {
      discNumber: true,
      trackNumber: true,
      track: {
        select: {
          ...mediaSummarySelect,
          track: { select: { durationSeconds: true, explicit: true } },
        },
      },
    },
  },
  // Si es una canción: los álbumes en los que aparece
  appearsOnAlbums: {
    select: {
      discNumber: true,
      trackNumber: true,
      album: { select: mediaSummarySelect },
    },
  },
} as const satisfies Prisma.MediaSelect;

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListMediaQuery) {
    const where: Prisma.MediaWhereInput = {
      type: query.type ? { in: query.type } : { not: MediaType.TRACK },
      OR: query.q
        ? [
            { title: { contains: query.q, mode: 'insensitive' } },
            { originalTitle: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
      genres: query.genre ? { some: { slug: query.genre } } : undefined,
      credits: query.creator
        ? { some: { creator: { slug: query.creator } } }
        : undefined,
      releaseDate: query.year
        ? {
            gte: new Date(Date.UTC(query.year, 0, 1)),
            lt: new Date(Date.UTC(query.year + 1, 0, 1)),
          }
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.media.findMany({
        where,
        orderBy: ORDER_BY[query.sort],
        select: mediaSummarySelect,
        ...pageArgs(query),
      }),
      this.prisma.media.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  // `userId` (opcional): si hay sesión, se incluye la reseña propia
  async findOne(idOrSlug: string, userId?: string) {
    const media = await this.prisma.media.findUnique({
      where: whereIdOrSlug(idOrSlug) as Prisma.MediaWhereUniqueInput,
      select: mediaDetailSelect,
    });
    if (!media) throw new NotFoundException('Obra no encontrada');

    const [distribution, myReview] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { mediaId: media.id, rating: { not: null } },
        _count: { _all: true },
      }),
      userId
        ? this.prisma.review.findUnique({
            where: { userId_mediaId: { userId, mediaId: media.id } },
            omit: { userId: true, mediaId: true },
          })
        : null,
    ]);

    const {
      movie,
      series,
      album,
      track,
      game,
      albumTracks,
      appearsOnAlbums,
      ...rest
    } = media;
    const details = { movie, series, album, track, game }[
      DETAILS_RELATION[media.type]
    ];
    return {
      ...rest,
      details,
      // Cuántas notas hay de cada valor, del 1 al 10
      ratingDistribution: Array.from({ length: 10 }, (_, i) => ({
        rating: i + 1,
        count: distribution.find((d) => d.rating === i + 1)?._count._all ?? 0,
      })),
      ...(media.type === MediaType.ALBUM && { tracks: albumTracks }),
      ...(media.type === MediaType.TRACK && { albums: appearsOnAlbums }),
      myReview,
    };
  }

  // `externalIds`: solo para importaciones (no se expone en la API). Se crean
  // en la misma sentencia, así que dos importaciones simultáneas de la misma
  // obra no la duplican: la segunda falla con P2002.
  async create(
    dto: CreateMediaDto,
    { externalIds }: { externalIds?: ExternalRef[] } = {},
  ) {
    const { type, details, genres, credits, slug, ...fields } = dto;
    await this.assertCreditsValid(type, credits);
    const genreIds = await this.resolveGenres(genres);

    const year = fields.releaseDate?.getUTCFullYear();
    const finalSlug =
      slug ??
      (await uniqueSlug(
        // El año no se repite si el título ya lo lleva ("... 1997 2017")
        year && !fields.title.includes(String(year))
          ? `${fields.title} ${year}`
          : fields.title,
        async (s) =>
          (await this.prisma.media.count({ where: { slug: s } })) > 0,
        [type.toLowerCase(), year].filter(Boolean).join('-'),
      ));

    // `details` ya viene validado por createMediaSchema (con sus valores por
    // defecto). Sin `details` se aplican los del tipo. No se valida dos veces:
    // la primera convierte las fechas a Date y la segunda las rechazaría.
    const detailsData = details ?? DETAILS_SCHEMAS[type].parse({});
    const created = await this.prisma.media.create({
      data: {
        ...fields,
        type,
        slug: finalSlug,
        [DETAILS_RELATION[type]]: { create: detailsData },
        genres: genreIds ? { connect: genreIds } : undefined,
        credits: credits
          ? {
              create: credits.map((c, i) => ({
                ...c,
                position: c.position ?? i,
              })),
            }
          : undefined,
        externalIds: externalIds?.length ? { create: externalIds } : undefined,
      },
      select: { id: true },
    });
    return this.findOne(created.id);
  }

  async update(id: string, dto: UpdateMediaDto) {
    const media = await this.prisma.media.findUnique({
      where: { id },
      select: { type: true },
    });
    if (!media) throw new NotFoundException('Obra no encontrada');

    const { details, genres, credits, ...fields } = dto;
    await this.assertCreditsValid(media.type, credits);
    const genreIds = await this.resolveGenres(genres);
    const detailsData = details
      ? this.parseDetailsUpdate(media.type, details)
      : undefined;

    await this.prisma.$transaction(async (tx) => {
      if (credits) {
        await tx.credit.deleteMany({ where: { mediaId: id } });
      }
      await tx.media.update({
        where: { id },
        data: {
          ...fields,
          [DETAILS_RELATION[media.type]]: detailsData
            ? { upsert: { create: detailsData, update: detailsData } }
            : undefined,
          genres: genreIds ? { set: genreIds } : undefined,
          credits: credits
            ? {
                create: credits.map((c, i) => ({
                  ...c,
                  position: c.position ?? i,
                })),
              }
            : undefined,
        },
      });
    });
    return this.findOne(id);
  }

  // Borra también sus detalles, créditos, reseñas y listas de canciones (cascada)
  async remove(id: string): Promise<void> {
    await this.prisma.media.delete({ where: { id } });
  }

  // Agrega una canción a un álbum sin tocar el resto de la lista. Si la
  // canción ya está o su posición está ocupada, no hace nada.
  async addTrackToAlbum(
    albumId: string,
    trackId: string,
    position: { discNumber: number; trackNumber: number },
  ): Promise<void> {
    await this.prisma.albumTrack.createMany({
      data: [{ albumId, trackId, ...position }],
      skipDuplicates: true,
    });
  }

  async setTracks(albumId: string, dto: SetTracksDto) {
    const album = await this.prisma.media.findUnique({
      where: { id: albumId },
      select: { type: true },
    });
    if (!album) throw new NotFoundException('Obra no encontrada');
    if (album.type !== MediaType.ALBUM) {
      throw new BadRequestException('Solo los álbumes tienen canciones');
    }

    const ids = dto.tracks.map((t) => t.trackId);
    const found = await this.prisma.media.findMany({
      where: { id: { in: ids }, type: MediaType.TRACK },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      const valid = new Set(found.map((t) => t.id));
      const invalid = ids.filter((trackId) => !valid.has(trackId));
      throw new BadRequestException(
        `No existen o no son canciones: ${invalid.join(', ')}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.albumTrack.deleteMany({ where: { albumId } }),
      this.prisma.albumTrack.createMany({
        data: dto.tracks.map((t) => ({ albumId, ...t })),
      }),
    ]);
    return this.findOne(albumId);
  }

  // Valida `details` con el esquema del tipo, con todos sus campos opcionales
  private parseDetailsUpdate(
    type: MediaType,
    details: Record<string, unknown>,
  ) {
    const result = DETAILS_SCHEMAS[type].partial().safeParse(details);
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues.map(
          (issue) =>
            `${['details', ...issue.path.map(String)].join('.')}: ${issue.message}`,
        ),
      );
    }
    // Zod aplica los valores por defecto aunque el campo no venga (p. ej.
    // albumType = ALBUM): se conservan solo los campos enviados, para no
    // sobrescribir los que no se tocaron
    return Object.fromEntries(
      Object.entries(result.data).filter(([key]) => key in details),
    );
  }

  private async resolveGenres(slugs: string[] | undefined) {
    if (!slugs) return undefined;
    const unique = [...new Set(slugs)];
    const genres = await this.prisma.genre.findMany({
      where: { slug: { in: unique } },
      select: { id: true, slug: true },
    });
    if (genres.length !== unique.length) {
      const found = new Set(genres.map((g) => g.slug));
      const missing = unique.filter((slug) => !found.has(slug));
      throw new BadRequestException(
        `Géneros que no existen: ${missing.join(', ')}`,
      );
    }
    return genres.map(({ id }) => ({ id }));
  }

  private async assertCreditsValid(
    type: MediaType,
    credits: { creatorId: string; role: string }[] | undefined,
  ) {
    if (!credits?.length) return;
    const allowed: string[] = ALLOWED_ROLES[type];
    const badRoles = [...new Set(credits.map((c) => c.role))].filter(
      (role) => !allowed.includes(role),
    );
    if (badRoles.length) {
      throw new BadRequestException(
        `Roles no válidos para ${type}: ${badRoles.join(', ')}. Permitidos: ${allowed.join(', ')}`,
      );
    }

    const ids = [...new Set(credits.map((c) => c.creatorId))];
    const count = await this.prisma.creator.count({
      where: { id: { in: ids } },
    });
    if (count !== ids.length) {
      throw new BadRequestException('Alguno de los creadores no existe');
    }
  }
}
