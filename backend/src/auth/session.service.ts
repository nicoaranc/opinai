import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicUserSelect, type PublicUser } from '../users/public-user.js';
import type { ClientMeta } from './auth.types.js';

const DAY = 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_TTL_MS = 30 * DAY;
export const SESSION_IDLE_TTL_MS = 7 * DAY;
// lastActiveAt se actualiza como mucho una vez por hora, no en cada petición
export const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export interface ValidSession {
  sessionId: string;
  user: PublicUser;
}

export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class SessionService {
  readonly cookieName: string;
  private readonly secure: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.secure =
      config.get('COOKIE_SECURE', { infer: true }) ??
      config.get('NODE_ENV', { infer: true }) === 'production';
    // El prefijo __Host- obliga a Secure, path=/ y sin Domain
    this.cookieName = this.secure ? '__Host-opinai_sid' : 'opinai_sid';
  }

  async create(
    userId: string,
    meta: ClientMeta,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);

    await this.prisma.$transaction([
      // Limpieza: sesiones caducadas del mismo usuario
      this.prisma.session.deleteMany({
        where: { userId, expiresAt: { lte: now } },
      }),
      this.prisma.session.create({
        data: {
          id: hashToken(token),
          userId,
          expiresAt,
          lastActiveAt: now,
          userAgent: meta.userAgent?.slice(0, 255),
          ip: meta.ip,
        },
      }),
    ]);
    return { token, expiresAt };
  }

  async validate(
    token: string,
    now = new Date(),
  ): Promise<ValidSession | null> {
    const id = hashToken(token);
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { user: { select: publicUserSelect } },
    });
    if (!session) return null;

    const idleFor = now.getTime() - session.lastActiveAt.getTime();
    if (session.expiresAt <= now || idleFor >= SESSION_IDLE_TTL_MS) {
      await this.prisma.session.deleteMany({ where: { id } });
      return null;
    }
    if (idleFor >= SESSION_TOUCH_INTERVAL_MS) {
      await this.prisma.session.updateMany({
        where: { id },
        data: { lastActiveAt: now },
      });
    }
    return { sessionId: id, user: session.user };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  cookieOptions(expiresAt?: Date): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    };
  }
}
