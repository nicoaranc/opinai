import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';

@Module({
  controllers: [MediaController],
  providers: [MediaService],
  // Lo usan las integraciones para crear las obras importadas
  exports: [MediaService],
})
export class MediaModule {}
