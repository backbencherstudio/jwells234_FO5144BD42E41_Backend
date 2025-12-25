import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionWebhookController } from './subscription.webhook.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionController, SubscriptionWebhookController],
  providers: [SubscriptionService],
})
export class SubscriptionModule {}
