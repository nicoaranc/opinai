import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { uuidSchema } from '../common/params.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  createGenreSchema,
  updateGenreSchema,
  type CreateGenreDto,
  type UpdateGenreDto,
} from './genres.schemas.js';
import { GenresService } from './genres.service.js';

@ApiTags('Géneros')
@Controller('genres')
export class GenresController {
  constructor(private readonly genres: GenresService) {}

  @Get()
  @Public()
  findAll() {
    return this.genres.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body({ schema: createGenreSchema }) dto: CreateGenreDto) {
    return this.genres.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', { schema: uuidSchema }) id: string,
    @Body({ schema: updateGenreSchema }) dto: UpdateGenreDto,
  ) {
    return this.genres.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', { schema: uuidSchema }) id: string) {
    return this.genres.remove(id);
  }
}
