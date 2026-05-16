import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationController } from './notification.controller';
import { FcmService } from './services/fcm.service';
import { PushNotificationProcessor } from './processors/push-notification.processor';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'push-queue',
    }),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationGateway,
    NotificationService,
    FcmService,
    PushNotificationProcessor,
  ],
  exports: [NotificationGateway, NotificationService, FcmService],
})
export class NotificationModule {}
