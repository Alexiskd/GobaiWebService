import { Module } from '@nestjs/common';
import { SunController } from '../controllers/sun.controller';
import { SunService } from '../services/sun/sun.service';

@Module({
  controllers: [SunController],
  providers: [SunService],
  exports: [SunService],
})
export class SunModule {}
