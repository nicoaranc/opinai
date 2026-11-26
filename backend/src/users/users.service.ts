import { Injectable, NotFoundException } from '@nestjs/common';
import { userSummarySelect } from '../common/selects.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicUserSelect } from './public-user.js';
import type { UpdateProfileDto } from './users.schemas.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Perfil público: sin email
  async findProfile(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { ...userSummarySelect, bio: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const [rated, total, withText] = await Promise.all([
      this.prisma.review.aggregate({
        where: { userId: user.id, rating: { not: null } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.review.count({ where: { userId: user.id } }),
      this.prisma.review.count({
        where: { userId: user.id, body: { not: null } },
      }),
    ]);
    const avg = rated._avg.rating;
    return {
      ...user,
      stats: {
        reviewCount: total, // total de reseñas (con o sin nota)
        writtenCount: withText, // con texto
        ratingCount: rated._count.rating, // con nota
        ratingAvg: avg === null ? null : Math.round(avg * 100) / 100,
      },
    };
  }

  async findIdByUsername(username: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user.id;
  }

  updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: publicUserSelect,
    });
  }
}
