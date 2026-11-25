import { ServiceUnavailableException } from '@nestjs/common';
import argon2 from 'argon2';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  afterEach(() => vi.restoreAllMocks());

  it('cifra con argon2id y los parámetros de OWASP (19 MiB, t=2, p=1)', async () => {
    const hash = await passwords.hash('secreta123');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    await expect(passwords.verify(hash, 'secreta123')).resolves.toBe(true);
    expect(passwords.needsRehash(hash)).toBe(false);
  });

  it('pide re-cifrar los hashes con los parámetros anteriores (64 MiB)', async () => {
    const old = await argon2.hash('secreta123', { type: argon2.argon2id });
    expect(passwords.needsRehash(old)).toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await passwords.hash('secreta123');
    await expect(passwords.verify(hash, 'otra')).resolves.toBe(false);
  });

  it('devuelve false si no hay hash (email inexistente)', async () => {
    await expect(
      passwords.verify(undefined, 'dummy-password-for-timing'),
    ).resolves.toBe(false);
  });

  it('devuelve false con un hash de formato inválido', async () => {
    await expect(passwords.verify('no-es-un-hash', 'x')).resolves.toBe(false);
  });

  it('ejecuta como mucho 4 cálculos a la vez y responde 503 si la cola se llena', async () => {
    let running = 0;
    let peak = 0;
    const pending: (() => void)[] = [];
    vi.spyOn(argon2, 'hash').mockImplementation(() => {
      running++;
      peak = Math.max(peak, running);
      return new Promise<string>((resolve) =>
        pending.push(() => {
          running--;
          resolve('hash');
        }),
      );
    });

    const service = new PasswordService();
    // 4 en curso + 50 en cola = 54 aceptadas; la 55 se rechaza
    const accepted = Array.from({ length: 54 }, () => service.hash('x'));
    await expect(service.hash('x')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    // Se van liberando de a una y nunca hay más de 4 corriendo
    while (pending.length) {
      pending.shift()?.();
      await new Promise((resolve) => setImmediate(resolve));
    }
    await expect(Promise.all(accepted)).resolves.toHaveLength(54);
    expect(peak).toBe(4);
  });
});
