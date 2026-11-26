import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import {
  listUserReviewsQuerySchema,
  type ListUserReviewsQuery,
} from '../reviews/reviews.schemas.js';
import { ReviewsService } from '../reviews/reviews.service.js';
import type { PublicUser } from './public-user.js';
import { updateProfileSchema, type UpdateProfileDto } from './users.schemas.js';
import { UsersService } from './users.service.js';

@ApiTags('Usuarios')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly reviews: ReviewsService,
  ) {}

  // Edita el perfil propio (nombre visible, bio, avatar)
  @Patch('me')
  updateMe(
    @CurrentUser() user: PublicUser,
    @Body({ schema: updateProfileSchema }) dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(user.id, dto);
  }

  @Get(':username')
  @Public()
  findOne(@Param('username') username: string) {
    return this.users.findProfile(username);
  }

  @Get(':username/reviews')
  @Public()
  async findReviews(
    @Param('username') username: string,
    @Query({ schema: listUserReviewsQuerySchema }) query: ListUserReviewsQuery,
  ) {
    const userId = await this.users.findIdByUsername(username);
    return this.reviews.findByUser(userId, query);
  }
}
