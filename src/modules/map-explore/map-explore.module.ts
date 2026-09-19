import { Module } from '@nestjs/common';
import { MapExploreService } from './map-explore.service';
import { MapExploreController } from './map-explore.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MapExploreController],
  providers: [MapExploreService],
})
export class MapExploreModule {}
