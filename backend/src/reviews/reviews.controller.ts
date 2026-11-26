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
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { uuidSchema } from '../common/params.js';
import type { PublicUser } from '../users/public-user.js';
import {
  createReviewSchema,
  listReviewsQuerySchema,
  updateReviewSchema,
  type CreateReviewDto,
  type ListReviewsQuery,
  type UpdateReviewDto,
} from './reviews.schemas.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('Reseñas')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('media/:idOrSlug/reviews')
  @Public()
  findByMedia(
    @Param('idOrSlug') idOrSlug: string,
    @Query({ schema: listReviewsQuerySchema }) query: ListReviewsQuery,
  ) {
    return this.reviews.findByMedia(idOrSlug, query);
  }

  // Una por usuario y obra: si ya existe responde 409
  @Post('media/:id/reviews')
  create(
    @Param('id', { schema: uuidSchema }) mediaId: string,
    @CurrentUser() user: PublicUser,
    @Body({ schema: createReviewSchema }) dto: CreateReviewDto,
  ) {
    return this.reviews.create(mediaId, user.id, dto);
  }

  @Get('reviews/:id')
  @Public()
  findOne(@Param('id', { schema: uuidSchema }) id: string) {
    return this.reviews.findOne(id);
  }

  @Patch('reviews/:id')
  update(
    @Param('id', { schema: uuidSchema }) id: string,
    @CurrentUser() user: PublicUser,
    @Body({ schema: updateReviewSchema }) dto: UpdateReviewDto,
  ) {
    return this.reviews.update(id, user, dto);
  }

  @Delete('reviews/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', { schema: uuidSchema }) id: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.reviews.remove(id, user);
  }
}
