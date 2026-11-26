import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [ReviewsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
