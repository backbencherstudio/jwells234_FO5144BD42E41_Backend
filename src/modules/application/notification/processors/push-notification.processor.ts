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

    const { receiver_id, tokens, title, body, data } = job.data;

    if (!tokens?.length) {
      this.logger.warn(`No tokens provided for receiver_id: ${receiver_id}. Skipping push send.`);
      return;
    }

    if (!this.fcmService.isReady()) {
      this.logger.warn(
        `Firebase is not initialized. Skipping push send to user ${receiver_id}. Title: "${title}"`,
      );
      return;
    }

    this.logger.log(
      `Attempting to send push notification to user ${receiver_id}. Title: "${title}", Body: "${body}". Tokens: ${JSON.stringify(
        tokens,
      )}`,
    );

    const response = await this.fcmService.sendMulticast({
      tokens,
      notification: { title, body },
      data,
    });

    if (!response) {
      this.logger.error(`FCM multicast returned null response for user ${receiver_id}.`);
      return;
    }

    this.logger.log(
      `FCM multicast response for user ${receiver_id} - Success count: ${response.successCount}, Failure count: ${response.failureCount}`,
    );

    const invalidTokens: string[] = [];

    response.responses.forEach((item, index) => {
      const token = tokens[index];
      if (!item.success) {
        const errorCode = item.error?.code || '';
        const errorMessage = item.error?.message || 'Unknown error';
        this.logger.error(
          `Failed to send push to token: ${token}. Error Code: ${errorCode}, Message: ${errorMessage}`,
        );

        if (
          errorCode.includes('registration-token-not-registered') ||
          errorCode.includes('invalid-argument')
        ) {
          invalidTokens.push(token);
        }
      } else {
        this.logger.log(`Successfully sent push to token: ${token}`);
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
        `Removed ${invalidTokens.length} invalid FCM tokens from database for user ${receiver_id}`,
      );
    }
  }
}
