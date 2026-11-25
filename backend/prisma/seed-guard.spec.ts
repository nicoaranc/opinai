import { assertSafeToSeed } from './seed-guard.js';

const local = 'postgresql://opinai:opinai@localhost:5433/opinai';
const supabase =
  'postgresql://postgres.abc:pw@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';

describe('assertSafeToSeed', () => {
  it('permite una base local en desarrollo', () => {
    expect(() =>
      assertSafeToSeed({ NODE_ENV: 'development', DATABASE_URL: local }),
    ).not.toThrow();
    expect(() =>
      assertSafeToSeed({
        DATABASE_URL: 'postgresql://u:p@127.0.0.1:5433/db',
      }),
    ).not.toThrow();
  });

  it('rechaza una base remota aunque NODE_ENV sea development', () => {
    expect(() =>
      assertSafeToSeed({ NODE_ENV: 'development', DATABASE_URL: supabase }),
    ).toThrow(/pooler\.supabase\.com/);
  });

  it('rechaza producción aunque la base sea local', () => {
    expect(() =>
      assertSafeToSeed({ NODE_ENV: 'production', DATABASE_URL: local }),
    ).toThrow(/producción/);
  });

  it('rechaza si falta DATABASE_URL o no es válida', () => {
    expect(() => assertSafeToSeed({})).toThrow();
    expect(() => assertSafeToSeed({ DATABASE_URL: 'no-es-url' })).toThrow();
  });
});
