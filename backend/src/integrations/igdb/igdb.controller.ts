import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  igdbImportSchema,
  igdbSearchQuerySchema,
  type IgdbImportDto,
  type IgdbSearchQuery,
} from './igdb.schemas.js';
import { IgdbService } from './igdb.service.js';

// Igual que TMDB y Deezer: cualquier usuario con sesión puede buscar e importar
@ApiTags('IGDB')
@Controller('igdb')
export class IgdbController {
  constructor(private readonly igdb: IgdbService) {}

  @Get('search')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  search(@Query({ schema: igdbSearchQuerySchema }) query: IgdbSearchQuery) {
    return this.igdb.search(query);
  }

  // 201 si se importó ahora, 200 si ya estaba
  @Post('imports')
  @Throttle({ default: { limit: 30, ttl: 10 * 60_000 } })
  async import(
    @Body({ schema: igdbImportSchema }) dto: IgdbImportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.igdb.import(dto);
    res.status(result.created ? 201 : 200);
    return result;
  }
}
