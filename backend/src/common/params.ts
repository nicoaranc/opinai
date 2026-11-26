import { z } from 'zod';

// IDs de la base (UUID). Validarlos evita que Prisma falle con un 500 ante
// un texto que no es UUID.
export const uuidSchema = z.uuid({ error: 'ID inválido' });

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    error: 'Solo letras minúsculas, números y guiones',
  });

// Las rutas de lectura aceptan el ID o el slug: /media/parasite-2019
export function whereIdOrSlug(
  value: string,
): { id: string } | { slug: string } {
  return uuidSchema.safeParse(value).success
    ? { id: value }
    : { slug: value.toLowerCase() };
}

// Fecha "YYYY-MM-DD" → Date a medianoche UTC (columnas @db.Date)
export const isoDateSchema = z.iso
  .date({ error: 'Fecha inválida, usa el formato AAAA-MM-DD' })
  .transform((value) => new Date(`${value}T00:00:00Z`));
