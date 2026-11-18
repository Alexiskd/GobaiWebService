// Racine de l'API : un module par domaine de routes.
import { Module } from '@nestjs/common';
import { SceneModule } from './scene/scene.module';
import { TilesModule } from './tiles/tiles.module';
import { DonationsModule } from './donations/donations.module';
import { ContributionsModule } from './contributions/contributions.module';

@Module({
  imports: [SceneModule, TilesModule, DonationsModule, ContributionsModule],
})
export class AppModule {}
