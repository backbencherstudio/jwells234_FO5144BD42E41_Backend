import { Module } from '@nestjs/common';
import { ShoutManageService } from './shout_manage.service';
import { ShoutManageController } from './shout_manage.controller';

@Module({
  controllers: [ShoutManageController],
  providers: [ShoutManageService],
})
export class ShoutManageModule {}
