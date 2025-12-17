import { Module } from '@nestjs/common';
import { ShoutService } from './shout.service';
import { ShoutController } from './shout.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ShoutController],
  providers: [ShoutService],
})
export class ShoutModule {}
