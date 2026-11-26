import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { pageArgs, toPage } from '../common/pagination.js';
import { whereIdOrSlug } from '../common/params.js';
import { mediaSummarySelect, userSummarySelect } from '../common/selects.js';
import {
  Prisma,
  UserRole,
  type MediaType,
} from '../generated/prisma/client.js';
import { lockMedia, recomputeMediaStats } from '../media/media-stats.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PublicUser } from '../users/public-user.js';
import {
  reviewContentIssues,
  type CreateReviewDto,
  type ListReviewsQuery,
  type ListUserReviewsQuery,
  type UpdateReviewDto,
} from './reviews.schemas.js';

const reviewFields = {
  id: true,
  rating: true,
  title: true,
  body: true,
  containsSpoilers: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ReviewSelect;

const reviewSelect = {
  ...reviewFields,
  user: { select: userSummarySelect },
  media: { select: mediaSummarySelect },
} as const satisfies Prisma.ReviewSelect;

const ORDER_BY: Record<
  ListReviewsQuery['sort'],
  Prisma.ReviewOrderByWithRelationInput[]
> = {
  recent: [{ createdAt: 'desc' }],
  oldest: [{ createdAt: 'asc' }],
  rating_desc: [
    { rating: { sort: 'desc', nulls: 'last' } },
    { createdAt: 'desc' },
  ],
  rating_asc: [
    { rating: { sort: 'asc', nulls: 'last' } },
    { createdAt: 'desc' },
  ],
};

// true: solo con texto · false: solo valoraciones (nota sin texto) · sin
// indicar: todas
const textFilter = (withText?: boolean): Prisma.ReviewWhereInput =>
  withText === undefined ? {} : { body: withText ? { not: null } : null };

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByMedia(idOrSlug: string, query: ListReviewsQuery) {
    const media = await this.prisma.media.findUnique({
      where: whereIdOrSlug(idOrSlug) as Prisma.MediaWhereUniqueInput,
      select: { id: true },
    });
    if (!media) throw new NotFoundException('Obra no encontrada');

    const where: Prisma.ReviewWhereInput = {
      mediaId: media.id,
      ...textFilter(query.withText),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: ORDER_BY[query.sort],
        select: { ...reviewFields, user: { select: userSummarySelect } },
        ...pageArgs(query),
      }),
      this.prisma.review.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  async findByUser(userId: string, query: ListUserReviewsQuery) {
    const where: Prisma.ReviewWhereInput = {
      userId,
      ...textFilter(query.withText),
      media: query.type ? { type: query.type as MediaType } : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: ORDER_BY[query.sort],
        select: { ...reviewFields, media: { select: mediaSummarySelect } },
        ...pageArgs(query),
      }),
      this.prisma.review.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  async findOne(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: reviewSelect,
    });
    if (!review) throw new NotFoundException('Reseña no encontrada');
    return review;
  }

  async create(mediaId: string, userId: string, dto: CreateReviewDto) {
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        if (!(await lockMedia(tx, mediaId))) {
          throw new NotFoundException('Obra no encontrada');
        }
        const existing = await tx.review.findUnique({
          where: { userId_mediaId: { userId, mediaId } },
          select: { id: true },
        });
        if (existing) throw this.alreadyReviewed(existing.id);

        const review = await tx.review.create({
          data: { ...dto, userId, mediaId },
          select: { id: true },
        });
        await recomputeMediaStats(tx, mediaId);
        return review.id;
      });
      return this.findOne(id);
    } catch (error) {
      // Dos altas simultáneas del mismo usuario: la segunda choca con la
      // restricción única
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.alreadyReviewed();
      }
      throw error;
    }
  }

  // Solo el autor puede editar su reseña
  async update(id: string, user: PublicUser, dto: UpdateReviewDto) {
    const current = await this.findOwnedOrThrow(id, user, {
      allowAdmin: false,
    });

    const merged = { ...current, ...dto };
    const issues = reviewContentIssues(merged);
    if (issues.length) throw new BadRequestException(issues);

    await this.prisma.$transaction(async (tx) => {
      await lockMedia(tx, current.mediaId);
      await tx.review.update({ where: { id }, data: dto });
      await recomputeMediaStats(tx, current.mediaId);
    });
    return this.findOne(id);
  }

  // El autor o un ADMIN (moderación)
  async remove(id: string, user: PublicUser): Promise<void> {
    const current = await this.findOwnedOrThrow(id, user, { allowAdmin: true });
    await this.prisma.$transaction(async (tx) => {
      await lockMedia(tx, current.mediaId);
      await tx.review.deleteMany({ where: { id } });
      await recomputeMediaStats(tx, current.mediaId);
    });
  }

  private async findOwnedOrThrow(
    id: string,
    user: PublicUser,
    { allowAdmin }: { allowAdmin: boolean },
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: {
        userId: true,
        mediaId: true,
        rating: true,
        title: true,
        body: true,
      },
    });
    if (!review) throw new NotFoundException('Reseña no encontrada');

    const isOwner = review.userId === user.id;
    const isAdmin = allowAdmin && user.role === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Esta reseña no es tuya');
    }
    return review;
  }

  private alreadyReviewed(reviewId?: string) {
    return new ConflictException(
      reviewId
        ? `Ya reseñaste esta obra; edítala con PATCH /api/reviews/${reviewId}`
        : 'Ya reseñaste esta obra',
    );
  }
}
