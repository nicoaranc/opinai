import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { MediaImporter } from './media-importer.service.js';
import { TmdbClient } from './tmdb/tmdb.client.js';
import { TmdbController } from './tmdb/tmdb.controller.js';
import { TmdbService } from './tmdb/tmdb.service.js';

// APIs externas. Cada proveedor traduce sus datos a ImportedMedia y
// MediaImporter los guarda.
@Module({
  imports: [MediaModule],
  controllers: [TmdbController],
  providers: [MediaImporter, TmdbClient, TmdbService],
})
export class IntegrationsModule {}
