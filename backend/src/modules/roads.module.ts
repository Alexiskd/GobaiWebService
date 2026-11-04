import { Module } from '@nestjs/common';
import { RoadsController } from '../controllers/roads.controller';

@Module({ controllers: [RoadsController] })
export class RoadsModule {}
