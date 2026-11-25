import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { PublicUser } from '../users/public-user.js';
import {
  loginSchema,
  registerSchema,
  type LoginDto,
  type RegisterDto,
} from './auth.schemas.js';
import { AuthService, type AuthResult } from './auth.service.js';
import type { AuthenticatedRequest, ClientMeta } from './auth.types.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { SessionService } from './session.service.js';

// Registro e inicio de sesión: 10 intentos cada 15 minutos por IP
const AUTH_THROTTLE = { default: { limit: 10, ttl: 15 * 60 * 1000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post('register')
  @Public()
  @Throttle(AUTH_THROTTLE)
  async register(
    @Body({ schema: registerSchema }) dto: RegisterDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const result = await this.auth.register(dto, clientMeta(req));
    return this.startSession(res, result);
  }

  @Post('login')
  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body({ schema: loginSchema }) dto: LoginDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    // Si ya había una sesión en este navegador, se reemplaza
    if (req.sessionId) await this.auth.logout(req.sessionId);
    const result = await this.auth.login(dto, clientMeta(req));
    return this.startSession(res, result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    if (req.sessionId) await this.auth.logout(req.sessionId);
    res.clearCookie(this.sessions.cookieName, this.sessions.cookieOptions());
  }

  @Get('me')
  me(@CurrentUser() user: PublicUser): { user: PublicUser } {
    return { user };
  }

  private startSession(res: Response, { user, session }: AuthResult) {
    res.cookie(
      this.sessions.cookieName,
      session.token,
      this.sessions.cookieOptions(session.expiresAt),
    );
    return { user };
  }
}

function clientMeta(req: AuthenticatedRequest): ClientMeta {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}
