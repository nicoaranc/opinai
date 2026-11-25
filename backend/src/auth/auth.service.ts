import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicUserSelect, type PublicUser } from '../users/public-user.js';
import type { LoginDto, RegisterDto } from './auth.schemas.js';
import type { ClientMeta } from './auth.types.js';
import { LoginAttemptsService } from './login-attempts.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';

export interface AuthResult {
  user: PublicUser;
  session: { token: string; expiresAt: Date };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly attempts: LoginAttemptsService,
  ) {}

  async register(dto: RegisterDto, meta: ClientMeta): Promise<AuthResult> {
    const taken = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { email: true },
    });
    if (taken) {
      throw new ConflictException(
        taken.email === dto.email
          ? 'Ese email ya está registrado'
          : 'Ese nombre de usuario ya está en uso',
      );
    }

    // Si dos registros iguales llegan a la vez, la restricción única de la
    // base responde 409 a través del filtro de errores.
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        displayName: dto.displayName,
        passwordHash: await this.passwords.hash(dto.password),
      },
      select: publicUserSelect,
    });
    const session = await this.sessions.create(user.id, meta);
    return { user, session };
  }

  async login(dto: LoginDto, meta: ClientMeta): Promise<AuthResult> {
    // Antes de verificar nada: una cuenta bloqueada no gasta CPU en argon2
    this.attempts.assertAllowed(dto.email);

    const found = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { ...publicUserSelect, passwordHash: true },
    });
    const valid = await this.passwords.verify(
      found?.passwordHash,
      dto.password,
    );
    if (!found || !valid) {
      this.attempts.recordFailure(dto.email);
      // Mismo mensaje en ambos casos: no revela si el email existe
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    this.attempts.reset(dto.email);
    const { passwordHash, ...user } = found;
    if (this.passwords.needsRehash(passwordHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.passwords.hash(dto.password) },
      });
    }
    const session = await this.sessions.create(user.id, meta);
    return { user, session };
  }

  logout(sessionId: string): Promise<void> {
    return this.sessions.revoke(sessionId);
  }
}
