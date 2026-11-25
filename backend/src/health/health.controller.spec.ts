import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

async function createController(queryRaw: () => Promise<unknown>) {
  const moduleRef = await Test.createTestingModule({
    imports: [TerminusModule.forRoot({ logger: false })],
    controllers: [HealthController],
    providers: [
      {
        provide: PrismaService,
        // Igual que Prisma con Postgres: $runCommandRaw solo existe en MongoDB
        // y Terminus pasa a SELECT 1 al recibir este error.
        useValue: {
          $runCommandRaw: vi.fn(async () => {
            throw new Error('Use the mongodb provider to run raw commands');
          }),
          $queryRawUnsafe: vi.fn(queryRaw),
        },
      },
    ],
  }).compile();
  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  it('reporta ok cuando la base de datos responde', async () => {
    const controller = await createController(async () => [{ '?column?': 1 }]);

    await expect(controller.check()).resolves.toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' } },
    });
  });

  it('responde 503 cuando la base de datos no responde', async () => {
    const controller = await createController(async () => {
      throw new Error('connection refused');
    });

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
