import type { Prisma } from '../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

// Bloquea la fila de la obra hasta el fin de la transacción. Así, si dos
// reseñas de la misma obra se guardan a la vez, la segunda espera a que la
// primera termine y su recálculo ya la incluye. Debe llamarse ANTES de
// escribir la reseña.
export async function lockMedia(tx: Tx, mediaId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM media WHERE id = ${mediaId}::uuid FOR UPDATE`;
  return rows.length > 0;
}

// Recalcula ratingAvg, ratingCount y reviewCount a partir de las reseñas
export async function recomputeMediaStats(
  tx: Tx,
  mediaId: string,
): Promise<void> {
  const [rated, total] = await Promise.all([
    tx.review.aggregate({
      where: { mediaId, rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    tx.review.count({ where: { mediaId } }),
  ]);
  const avg = rated._avg.rating;
  await tx.media.update({
    where: { id: mediaId },
    data: {
      ratingAvg: avg === null ? null : Math.round(avg * 100) / 100,
      ratingCount: rated._count.rating,
      reviewCount: total,
    },
  });
}
