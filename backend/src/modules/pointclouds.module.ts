import { Module } from '@nestjs/common';
import { PointCloudsController } from '../controllers/pointclouds.controller';
import { LyonLidarService } from '../services/pointclouds/lyon-lidar.service';
import { PointCloudsService } from '../services/pointclouds/pointclouds.service';

@Module({
  controllers: [PointCloudsController],
  providers: [LyonLidarService, PointCloudsService],
})
export class PointCloudsModule {}
