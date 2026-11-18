// Module du domaine scène.
import { Module } from '@nestjs/common';
import { SceneController } from './scene.controller';
import { SceneService } from './scene.service';

@Module({
  controllers: [SceneController],
  providers: [SceneService],
})
export class SceneModule {}
