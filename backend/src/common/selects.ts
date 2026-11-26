import { CreditRole, type Prisma } from '../generated/prisma/client.js';

// Campos que se devuelven cuando un recurso aparece dentro de otro
// (p. ej. el autor de una reseña o la obra de un crédito).

// Usuario visible para cualquiera: nunca incluye email ni passwordHash
export const userSummarySelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const satisfies Prisma.UserSelect;

export const creatorSummarySelect = {
  id: true,
  slug: true,
  name: true,
  kind: true,
  imageUrl: true,
} as const satisfies Prisma.CreatorSelect;

export const genreSelect = {
  id: true,
  slug: true,
  name: true,
} as const satisfies Prisma.GenreSelect;

// Roles que identifican la autoría principal de una obra en una tarjeta:
// "Bong Joon-ho", "Radiohead", "Team Cherry"...
export const PRIMARY_ROLES: CreditRole[] = [
  CreditRole.DIRECTOR,
  CreditRole.SHOWRUNNER,
  CreditRole.PRIMARY_ARTIST,
  CreditRole.DEVELOPER,
];

export const mediaSummarySelect = {
  id: true,
  type: true,
  slug: true,
  title: true,
  originalTitle: true,
  releaseDate: true,
  coverUrl: true,
  ratingAvg: true,
  ratingCount: true,
  reviewCount: true,
  credits: {
    where: { role: { in: PRIMARY_ROLES } },
    orderBy: { position: 'asc' },
    take: 3,
    select: { role: true, creator: { select: creatorSummarySelect } },
  },
} as const satisfies Prisma.MediaSelect;

export type MediaSummary = Prisma.MediaGetPayload<{
  select: typeof mediaSummarySelect;
}>;
