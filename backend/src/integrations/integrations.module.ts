import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { DeezerClient } from './deezer/deezer.client.js';
import { DeezerController } from './deezer/deezer.controller.js';
import { DeezerService } from './deezer/deezer.service.js';
import { IgdbClient } from './igdb/igdb.client.js';
import { IgdbController } from './igdb/igdb.controller.js';
import { IgdbService } from './igdb/igdb.service.js';
import { MediaImporter } from './media-importer.service.js';
import { TmdbClient } from './tmdb/tmdb.client.js';
import { TmdbController } from './tmdb/tmdb.controller.js';
import { TmdbService } from './tmdb/tmdb.service.js';

// APIs externas. Cada proveedor traduce sus datos a ImportedMedia y
// MediaImporter los guarda.
@Module({
  imports: [MediaModule],
  controllers: [TmdbController, DeezerController, IgdbController],
  providers: [
    MediaImporter,
    TmdbClient,
    TmdbService,
    DeezerClient,
    DeezerService,
    IgdbClient,
    IgdbService,
  ],
})
export class IntegrationsModule {}
