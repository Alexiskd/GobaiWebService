import { Module } from '@nestjs/common';
import { PointCloudsController } from '../controllers/pointclouds.controller';
import { PointCloudsService } from '../services/pointclouds/pointclouds.service';

@Module({
  controllers: [PointCloudsController],
  providers: [PointCloudsService],
})
export class PointCloudsModule {}
