import { Injectable, NotFoundException } from '@nestjs/common';
import { pageArgs, toPage } from '../common/pagination.js';
import { whereIdOrSlug } from '../common/params.js';
import { creatorSummarySelect, mediaSummarySelect } from '../common/selects.js';
import { uniqueSlug } from '../common/slug.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateCreatorDto,
  CreatorMediaQuery,
  ListCreatorsQuery,
  UpdateCreatorDto,
} from './creators.schemas.js';

const creatorDetailSelect = {
  ...creatorSummarySelect,
  bio: true,
  country: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.CreatorSelect;

@Injectable()
export class CreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListCreatorsQuery) {
    const where: Prisma.CreatorWhereInput = {
      kind: query.kind,
      name: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.creator.findMany({
        where,
        orderBy: { name: 'asc' },
        select: creatorSummarySelect,
        ...pageArgs(query),
      }),
      this.prisma.creator.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  async findOne(idOrSlug: string) {
    const creator = await this.prisma.creator.findUnique({
      where: whereIdOrSlug(idOrSlug) as Prisma.CreatorWhereUniqueInput,
      select: {
        ...creatorDetailSelect,
        _count: { select: { credits: true } },
      },
    });
    if (!creator) throw new NotFoundException('Creador no encontrado');

    // Roles en los que aparece (para filtrar su obra en el front)
    const roles = await this.prisma.credit.groupBy({
      by: ['role'],
      where: { creatorId: creator.id },
      _count: { _all: true },
    });
    const { _count, ...rest } = creator;
    return {
      ...rest,
      creditsCount: _count.credits,
      roles: roles.map((r) => ({ role: r.role, count: r._count._all })),
    };
  }

  // Obras en las que participa, más recientes primero
  async findMedia(idOrSlug: string, query: CreatorMediaQuery) {
    const { id } = await this.findIdOrThrow(idOrSlug);
    const where: Prisma.CreditWhereInput = {
      creatorId: id,
      role: query.role,
      media: query.type ? { type: query.type } : undefined,
    };
    const [credits, total] = await this.prisma.$transaction([
      this.prisma.credit.findMany({
        where,
        orderBy: [
          { media: { releaseDate: { sort: 'desc', nulls: 'last' } } },
          { media: { title: 'asc' } },
        ],
        select: { role: true, media: { select: mediaSummarySelect } },
        ...pageArgs(query),
      }),
      this.prisma.credit.count({ where }),
    ]);
    return toPage(credits, total, query);
  }

  async create(dto: CreateCreatorDto) {
    const slug =
      dto.slug ??
      (await uniqueSlug(
        dto.name,
        async (s) =>
          (await this.prisma.creator.count({ where: { slug: s } })) > 0,
        dto.kind.toLowerCase(),
      ));
    return this.prisma.creator.create({
      data: { ...dto, slug },
      select: creatorDetailSelect,
    });
  }

  update(id: string, dto: UpdateCreatorDto) {
    return this.prisma.creator.update({
      where: { id },
      data: dto,
      select: creatorDetailSelect,
    });
  }

  // Borra también sus créditos (cascada); las obras se conservan
  async remove(id: string): Promise<void> {
    await this.prisma.creator.delete({ where: { id } });
  }

  private async findIdOrThrow(idOrSlug: string) {
    const creator = await this.prisma.creator.findUnique({
      where: whereIdOrSlug(idOrSlug) as Prisma.CreatorWhereUniqueInput,
      select: { id: true },
    });
    if (!creator) throw new NotFoundException('Creador no encontrado');
    return creator;
  }
}
