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
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { uuidSchema } from '../common/params.js';
import { UserRole } from '../generated/prisma/client.js';
import type { PublicUser } from '../users/public-user.js';
import {
  createMediaSchema,
  listMediaQuerySchema,
  setTracksSchema,
  updateMediaSchema,
  type CreateMediaDto,
  type ListMediaQuery,
  type SetTracksDto,
  type UpdateMediaDto,
} from './media.schemas.js';
import { MediaService } from './media.service.js';

@ApiTags('Obras')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @Public()
  findAll(@Query({ schema: listMediaQuerySchema }) query: ListMediaQuery) {
    return this.media.findAll(query);
  }

  // Pública; con sesión incluye además `myReview`
  @Get(':idOrSlug')
  @Public()
  findOne(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user?: PublicUser,
  ) {
    return this.media.findOne(idOrSlug, user?.id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body({ schema: createMediaSchema }) dto: CreateMediaDto) {
    return this.media.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', { schema: uuidSchema }) id: string,
    @Body({ schema: updateMediaSchema }) dto: UpdateMediaDto,
  ) {
    return this.media.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', { schema: uuidSchema }) id: string) {
    return this.media.remove(id);
  }

  // Reemplaza la lista de canciones de un álbum
  @Put(':id/tracks')
  @Roles(UserRole.ADMIN)
  setTracks(
    @Param('id', { schema: uuidSchema }) id: string,
    @Body({ schema: setTracksSchema }) dto: SetTracksDto,
  ) {
    return this.media.setTracks(id, dto);
  }
}
