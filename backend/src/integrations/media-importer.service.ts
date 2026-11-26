import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { slugify, uniqueSlug } from '../common/slug.js';
import { Prisma } from '../generated/prisma/client.js';
import { createMediaSchema } from '../media/media.schemas.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ExternalRef,
  ImportedCredit,
  ImportedMedia,
} from './imported-media.js';

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

// Guarda en la base una obra traída de un proveedor externo. Es idempotente:
// si la obra ya se importó (mismo ID externo), devuelve la existente.
@Injectable()
export class MediaImporter {
  private readonly logger = new Logger(MediaImporter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  // externalId → slug de las que ya están en la base
  async findImported(
    provider: string,
    externalIds: string[],
  ): Promise<Map<string, string>> {
    if (!externalIds.length) return new Map();
    const rows = await this.prisma.externalId.findMany({
      where: { provider, externalId: { in: externalIds } },
      select: { externalId: true, media: { select: { slug: true } } },
    });
    return new Map(rows.map((r) => [r.externalId, r.media.slug]));
  }

  // `ref`: ID de la obra en su proveedor. `load` trae y traduce sus datos;
  // solo se llama si la obra todavía no está en la base.
  async import(ref: ExternalRef, load: () => Promise<ImportedMedia>) {
    const existing = await this.findMediaId(ref);
    if (existing) {
      return { created: false, media: await this.media.findOne(existing) };
    }

    const item = await load();
    const [primary, ...extra] = item.externalIds;

    const genres = await this.ensureGenres(item.genres);
    const credits = await this.ensureCredits(item.credits);
    const parsed = createMediaSchema.safeParse({
      type: item.type,
      title: item.title,
      originalTitle: item.originalTitle,
      synopsis: item.synopsis,
      releaseDate: item.releaseDate,
      coverUrl: item.coverUrl,
      backdropUrl: item.backdropUrl,
      language: item.language,
      country: item.country,
      genres,
      credits,
      details: item.details,
    });
    if (!parsed.success) {
      this.logger.error(
        `Datos de ${primary.provider} inválidos (${primary.externalId}): ${parsed.error.message}`,
      );
      throw new BadGatewayException(
        `Los datos recibidos de ${primary.provider} no son válidos`,
      );
    }

    // Un ID extra (p. ej. el de IMDb) podría estar ya en otra obra: se omite
    const extraFree = await this.withoutTaken(extra);
    try {
      const media = await this.media.create(parsed.data, {
        externalIds: [primary, ...extraFree],
      });
      return { created: true, media };
    } catch (error) {
      // Otra petición importó la misma obra al mismo tiempo
      if (isUniqueViolation(error)) {
        const id = await this.findMediaId(primary);
        if (id) return { created: false, media: await this.media.findOne(id) };
      }
      throw error;
    }
  }

  private async findMediaId(ref: ExternalRef): Promise<string | null> {
    const row = await this.prisma.externalId.findUnique({
      where: { provider_externalId: ref },
      select: { mediaId: true },
    });
    return row?.mediaId ?? null;
  }

  private async withoutTaken(refs: ExternalRef[]): Promise<ExternalRef[]> {
    const free: ExternalRef[] = [];
    for (const ref of refs) {
      if (!(await this.findMediaId(ref))) free.push(ref);
    }
    return free;
  }

  // Busca cada género por nombre (sin distinguir mayúsculas) o por slug, y
  // crea los que falten. Devuelve los slugs.
  private async ensureGenres(names: string[]): Promise<string[]> {
    const slugs = new Set<string>();
    for (const raw of new Set(names.map((n) => n.trim()).filter(Boolean))) {
      const name = raw.slice(0, 50);
      const byName = await this.prisma.genre.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { slug: true },
      });
      if (byName) {
        slugs.add(byName.slug);
        continue;
      }
      const slug = slugify(name);
      if (!slug) continue;
      // upsert: si otra importación lo crea a la vez, no falla
      await this.prisma.genre.upsert({
        where: { slug },
        create: { slug, name },
        update: {},
      });
      slugs.add(slug);
    }
    return [...slugs];
  }

  // Busca o crea cada creador por su ID externo
  private async ensureCredits(credits: ImportedCredit[]) {
    const result: { creatorId: string; role: ImportedCredit['role'] }[] = [];
    const seen = new Set<string>();
    for (const credit of credits) {
      const creatorId = await this.ensureCreator(credit);
      const key = `${creatorId}:${credit.role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ creatorId, role: credit.role });
    }
    return result;
  }

  private async ensureCreator(credit: ImportedCredit): Promise<string> {
    const find = () =>
      this.prisma.creatorExternalId.findUnique({
        where: { provider_externalId: credit.ref },
        select: { creatorId: true },
      });

    const existing = await find();
    if (existing) return existing.creatorId;

    const name = credit.name.trim().slice(0, 150);
    // Reintenta si choca con otra importación simultánea (mismo creador o slug)
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = await uniqueSlug(
        name,
        async (s) =>
          (await this.prisma.creator.count({ where: { slug: s } })) > 0,
        credit.kind.toLowerCase(),
      );
      try {
        const creator = await this.prisma.creator.create({
          data: {
            kind: credit.kind,
            name,
            slug,
            imageUrl: credit.imageUrl,
            externalIds: { create: credit.ref },
          },
          select: { id: true },
        });
        return creator.id;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const created = await find();
        if (created) return created.creatorId;
      }
    }
    throw new BadGatewayException(`No se pudo guardar al creador ${name}`);
  }
}
