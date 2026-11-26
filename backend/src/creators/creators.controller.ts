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
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { uuidSchema } from '../common/params.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  createCreatorSchema,
  creatorMediaQuerySchema,
  listCreatorsQuerySchema,
  updateCreatorSchema,
  type CreateCreatorDto,
  type CreatorMediaQuery,
  type ListCreatorsQuery,
  type UpdateCreatorDto,
} from './creators.schemas.js';
import { CreatorsService } from './creators.service.js';

@ApiTags('Creadores')
@Controller('creators')
export class CreatorsController {
  constructor(private readonly creators: CreatorsService) {}

  @Get()
  @Public()
  findAll(
    @Query({ schema: listCreatorsQuerySchema }) query: ListCreatorsQuery,
  ) {
    return this.creators.findAll(query);
  }

  @Get(':idOrSlug')
  @Public()
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.creators.findOne(idOrSlug);
  }

  @Get(':idOrSlug/media')
  @Public()
  findMedia(
    @Param('idOrSlug') idOrSlug: string,
    @Query({ schema: creatorMediaQuerySchema }) query: CreatorMediaQuery,
  ) {
    return this.creators.findMedia(idOrSlug, query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body({ schema: createCreatorSchema }) dto: CreateCreatorDto) {
    return this.creators.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', { schema: uuidSchema }) id: string,
    @Body({ schema: updateCreatorSchema }) dto: UpdateCreatorDto,
  ) {
    return this.creators.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', { schema: uuidSchema }) id: string) {
    return this.creators.remove(id);
  }
}
