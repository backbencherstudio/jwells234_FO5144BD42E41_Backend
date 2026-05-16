import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FcmService } from '../services/fcm.service';

type PushJobData = {
  receiver_id: string;
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
};

@Injectable()
@Processor('push-queue')
export class PushNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(PushNotificationProcessor.name);

  constructor(
    private readonly fcmService: FcmService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<PushJobData>): Promise<any> {
    if (job.name !== 'sendPushToUser') {
      this.logger.warn(`Unknown push job type: ${job.name}`);
      return;
    }

    const { tokens, title, body, data } = job.data;

    if (!tokens?.length) {
      return;
    }

    if (!this.fcmService.isReady()) {
      this.logger.warn('Firebase is not initialized. Skipping push send.');
      return;
    }

    const response = await this.fcmService.sendMulticast({
      tokens,
      notification: { title, body },
      data,
    });

    if (!response) {
      return;
    }

    const invalidTokens: string[] = [];

    response.responses.forEach((item, index) => {
      if (!item.success) {
        const errorCode = item.error?.code || '';
        if (
          errorCode.includes('registration-token-not-registered') ||
          errorCode.includes('invalid-argument')
        ) {
          invalidTokens.push(tokens[index]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await this.prisma.deviceToken.deleteMany({
        where: {
          token: {
            in: invalidTokens,
          },
        },
      });

      this.logger.warn(
        `Removed ${invalidTokens.length} invalid FCM tokens from database`,
      );
    }
  }
}
