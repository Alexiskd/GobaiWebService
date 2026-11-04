import { Module } from '@nestjs/common';
import { BodiesController } from '../controllers/bodies.controller';
import { BodiesService } from '../services/bodies/bodies.service';

@Module({ controllers: [BodiesController], providers: [BodiesService], exports: [BodiesService] })
export class BodiesModule {}
