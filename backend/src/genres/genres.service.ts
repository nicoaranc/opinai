import { BadRequestException, Injectable } from '@nestjs/common';
import { genreSelect } from '../common/selects.js';
import { slugify } from '../common/slug.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateGenreDto, UpdateGenreDto } from './genres.schemas.js';

@Injectable()
export class GenresService {
  constructor(private readonly prisma: PrismaService) {}

  // Pocos registros: se devuelven todos, con cuántas obras tiene cada uno
  async findAll() {
    const genres = await this.prisma.genre.findMany({
      orderBy: { name: 'asc' },
      select: { ...genreSelect, _count: { select: { media: true } } },
    });
    return genres.map(({ _count, ...genre }) => ({
      ...genre,
      mediaCount: _count.media,
    }));
  }

  create(dto: CreateGenreDto) {
    return this.prisma.genre.create({
      data: { name: dto.name, slug: this.slugFor(dto.slug, dto.name) },
      select: genreSelect,
    });
  }

  // P2025 (no existe) → 404 y P2002 (slug repetido) → 409 en el filtro global
  update(id: string, dto: UpdateGenreDto) {
    return this.prisma.genre.update({
      where: { id },
      data: { name: dto.name, slug: dto.slug },
      select: genreSelect,
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.genre.delete({ where: { id } });
  }

  private slugFor(slug: string | undefined, name: string): string {
    const value = slug ?? slugify(name);
    if (!value) {
      throw new BadRequestException(
        'No se pudo generar un slug a partir del nombre; indícalo a mano',
      );
    }
    return value;
  }
}
