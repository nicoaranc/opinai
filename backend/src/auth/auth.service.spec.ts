import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { LoginAttemptsService } from './login-attempts.service.js';
import { PasswordService } from './password.service.js';
import type { SessionService } from './session.service.js';

const session = { token: 'tok', expiresAt: new Date() };
const meta = { ip: '127.0.0.1' };

async function setup() {
  const passwords = new PasswordService();
  const stored = {
    id: 'u1',
    email: 'ana@opinai.local',
    username: 'ana',
    passwordHash: await passwords.hash('opinai123'),
  };
  const prisma = {
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(({ where }: { where: { email: string } }) =>
        Promise.resolve(where.email === stored.email ? stored : null),
      ),
      create: vi.fn(({ data }: { data: object }) =>
        Promise.resolve({ id: 'u2', ...data }),
      ),
      update: vi.fn(),
    },
  };
  const sessions = { create: vi.fn().mockResolvedValue(session) };
  const auth = new AuthService(
    prisma as unknown as PrismaService,
    passwords,
    sessions as unknown as SessionService,
    new LoginAttemptsService(),
  );
  return { auth, prisma, sessions };
}

describe('AuthService', () => {
  it('inicia sesión con credenciales correctas y no devuelve el hash', async () => {
    const { auth, sessions } = await setup();
    const result = await auth.login(
      { email: 'ana@opinai.local', password: 'opinai123' },
      meta,
    );
    expect(result.user).toEqual({
      id: 'u1',
      email: 'ana@opinai.local',
      username: 'ana',
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(sessions.create).toHaveBeenCalledWith('u1', meta);
  });

  it('responde igual a una contraseña incorrecta y a un email inexistente', async () => {
    const { auth } = await setup();
    const wrongPassword = auth.login(
      { email: 'ana@opinai.local', password: 'x' },
      meta,
    );
    const unknownEmail = auth.login(
      { email: 'nadie@opinai.local', password: 'x' },
      meta,
    );
    await expect(wrongPassword).rejects.toThrow(UnauthorizedException);
    await expect(unknownEmail).rejects.toThrow(
      'Email o contraseña incorrectos',
    );
  });

  it('bloquea la cuenta tras 5 fallos, aunque luego la contraseña sea correcta', async () => {
    const { auth, sessions } = await setup();
    const attempt = (password: string) =>
      auth.login({ email: 'ana@opinai.local', password }, meta);

    for (let i = 0; i < 5; i++) {
      await expect(attempt('mala')).rejects.toThrow(UnauthorizedException);
    }
    await expect(attempt('opinai123')).rejects.toMatchObject({ status: 429 });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('un login correcto reinicia el contador de fallos', async () => {
    const { auth } = await setup();
    const attempt = (password: string) =>
      auth.login({ email: 'ana@opinai.local', password }, meta);

    for (let i = 0; i < 4; i++) await attempt('mala').catch(() => undefined);
    await attempt('opinai123');
    for (let i = 0; i < 4; i++) await attempt('mala').catch(() => undefined);
    await expect(attempt('opinai123')).resolves.toBeDefined();
  });

  it('registra con la contraseña cifrada', async () => {
    const { auth, prisma } = await setup();
    await auth.register(
      {
        email: 'nuevo@opinai.local',
        username: 'nuevo',
        password: 'secreta123',
      },
      meta,
    );
    const { data } = prisma.user.create.mock.calls[0][0] as {
      data: { passwordHash: string };
    };
    expect(data.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('indica si el email o el username ya existen', async () => {
    const { auth, prisma } = await setup();
    const dto = {
      email: 'ana@opinai.local',
      username: 'otra',
      password: 'secreta123',
    };

    prisma.user.findFirst.mockResolvedValueOnce({ email: 'ana@opinai.local' });
    await expect(auth.register(dto, meta)).rejects.toThrow(
      'Ese email ya está registrado',
    );

    prisma.user.findFirst.mockResolvedValueOnce({ email: 'otro@opinai.local' });
    await expect(auth.register(dto, meta)).rejects.toThrow(ConflictException);
  });
});
