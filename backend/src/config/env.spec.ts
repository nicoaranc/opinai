import { envSchema } from './env.js';

const DATABASE_URL = 'postgresql://u:p@localhost:5433/db';

describe('envSchema', () => {
  it('aplica valores por defecto', () => {
    expect(envSchema.parse({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
      CORS_ORIGINS: ['http://localhost:5173'],
    });
  });

  it('convierte PORT a número y separa CORS_ORIGINS', () => {
    const env = envSchema.parse({
      DATABASE_URL,
      PORT: '8080',
      CORS_ORIGINS: 'https://opinai.app, http://localhost:5173',
    });
    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual([
      'https://opinai.app',
      'http://localhost:5173',
    ]);
  });

  it('falla si falta DATABASE_URL', () => {
    expect(envSchema.safeParse({}).success).toBe(false);
  });

  it('falla si DATABASE_URL no es de Postgres', () => {
    expect(
      envSchema.safeParse({ DATABASE_URL: 'mysql://u:p@h/db' }).success,
    ).toBe(false);
  });

  it('falla si un origen de CORS no es una URL', () => {
    expect(
      envSchema.safeParse({ DATABASE_URL, CORS_ORIGINS: 'no-es-url' }).success,
    ).toBe(false);
  });
});
