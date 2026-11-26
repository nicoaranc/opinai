import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  deezerImportSchema,
  deezerSearchQuerySchema,
  type DeezerImportDto,
  type DeezerSearchQuery,
} from './deezer.schemas.js';
import { DeezerService } from './deezer.service.js';

// Igual que TMDB: cualquier usuario con sesión puede buscar e importar
@ApiTags('Deezer')
@Controller('deezer')
export class DeezerController {
  constructor(private readonly deezer: DeezerService) {}

  @Get('search')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  search(@Query({ schema: deezerSearchQuerySchema }) query: DeezerSearchQuery) {
    return this.deezer.search(query);
  }

  // Importar un álbum importa también sus canciones; importar una canción
  // importa su álbum. 201 si se importó ahora, 200 si ya estaba.
  @Post('imports')
  @Throttle({ default: { limit: 30, ttl: 10 * 60_000 } })
  async import(
    @Body({ schema: deezerImportSchema }) dto: DeezerImportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.deezer.import(dto);
    res.status(result.created ? 201 : 200);
    return result;
  }
}
