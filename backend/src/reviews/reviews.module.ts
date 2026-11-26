import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService],
  // UsersController lista las reseñas de un usuario
  exports: [ReviewsService],
})
export class ReviewsModule {}
