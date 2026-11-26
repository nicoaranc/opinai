import type { Prisma } from '../generated/prisma/client.js';
import { recomputeMediaStats } from './media-stats.js';

function tx(avg: number | null, rated: number, total: number) {
  const update = vi.fn();
  const client = {
    review: {
      aggregate: vi.fn().mockResolvedValue({
        _avg: { rating: avg },
        _count: { rating: rated },
      }),
      count: vi.fn().mockResolvedValue(total),
    },
    media: { update },
  } as unknown as Prisma.TransactionClient;
  return { client, update };
}

describe('recomputeMediaStats', () => {
  it('guarda el promedio redondeado a 2 decimales y los conteos', async () => {
    const { client, update } = tx(8.6666667, 3, 5);
    await recomputeMediaStats(client, 'm1');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { ratingAvg: 8.67, ratingCount: 3, reviewCount: 5 },
    });
  });

  it('deja el promedio en null si nadie puntuó', async () => {
    const { client, update } = tx(null, 0, 2);
    await recomputeMediaStats(client, 'm1');
    expect(update.mock.calls[0][0]).toMatchObject({
      data: { ratingAvg: null, ratingCount: 0, reviewCount: 2 },
    });
  });
});
