import { envSchema } from './env.js';

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
};

describe('envSchema', () => {
  it('aplica valores por defecto', () => {
    expect(envSchema.parse(base)).toEqual({
      ...base,
      PORT: 3000,
      CORS_ORIGINS: ['http://localhost:5173'],
      TRUST_PROXY: 0,
    });
  });

  it('falla si falta NODE_ENV', () => {
    expect(
      envSchema.safeParse({ DATABASE_URL: base.DATABASE_URL }).success,
    ).toBe(false);
  });

  it('exige CORS_ORIGINS en producción', () => {
    const production = { ...base, NODE_ENV: 'production' };
    const result = envSchema.safeParse(production);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['CORS_ORIGINS']);

    expect(
      envSchema.parse({ ...production, CORS_ORIGINS: 'https://opinai.app' })
        .CORS_ORIGINS,
    ).toEqual(['https://opinai.app']);
  });

  it('interpreta COOKIE_SECURE como booleano', () => {
    expect(
      envSchema.parse({ ...base, COOKIE_SECURE: 'true' }).COOKIE_SECURE,
    ).toBe(true);
    expect(
      envSchema.parse({ ...base, COOKIE_SECURE: 'false' }).COOKIE_SECURE,
    ).toBe(false);
    expect(
      envSchema.safeParse({ ...base, COOKIE_SECURE: 'quizas' }).success,
    ).toBe(false);
  });

  it('convierte PORT a número y separa CORS_ORIGINS', () => {
    const env = envSchema.parse({
      ...base,
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
    expect(envSchema.safeParse({ NODE_ENV: 'development' }).success).toBe(
      false,
    );
  });

  it('falla si DATABASE_URL no es de Postgres', () => {
    expect(
      envSchema.safeParse({ ...base, DATABASE_URL: 'mysql://u:p@h/db' })
        .success,
    ).toBe(false);
  });

  it('falla si un origen de CORS no es una URL', () => {
    expect(
      envSchema.safeParse({ ...base, CORS_ORIGINS: 'no-es-url' }).success,
    ).toBe(false);
  });
});
