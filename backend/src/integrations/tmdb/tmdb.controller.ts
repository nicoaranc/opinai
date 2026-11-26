import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  tmdbImportSchema,
  tmdbSearchQuerySchema,
  type TmdbImportDto,
  type TmdbSearchQuery,
} from './tmdb.schemas.js';
import { TmdbService } from './tmdb.service.js';

// Cualquier usuario con sesión puede buscar en TMDB e importar: así el
// catálogo crece con lo que la gente quiere reseñar. Requiere sesión para no
// gastar la cuota de TMDB con visitas anónimas.
@ApiTags('TMDB')
@Controller('tmdb')
export class TmdbController {
  constructor(private readonly tmdb: TmdbService) {}

  @Get('search')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  search(@Query({ schema: tmdbSearchQuerySchema }) query: TmdbSearchQuery) {
    return this.tmdb.search(query);
  }

  // 201 si se importó ahora, 200 si ya estaba en el catálogo
  @Post('imports')
  @Throttle({ default: { limit: 30, ttl: 10 * 60_000 } })
  async import(
    @Body({ schema: tmdbImportSchema }) dto: TmdbImportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.tmdb.import(dto);
    res.status(result.created ? 201 : 200);
    return result;
  }
}
