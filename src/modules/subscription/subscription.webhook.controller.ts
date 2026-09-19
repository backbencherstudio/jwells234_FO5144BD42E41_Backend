import {
  Controller,
  Post,
  Body,
  Headers,
  BadRequestException,
  Res,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import appConfig from '../../config/app.config';
import * as crypto from 'crypto';
import { Response, Request } from 'express';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('subscription')
@Controller('subscription/webhook')
export class SubscriptionWebhookController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  async handleWebhook(
    @Req() req: Request,
    @Body() body: any,
    @Headers('x-paystack-signature') signature: string,
    @Res() res: Response,
  ) {
    const secret = appConfig().payment.paystack.secret_key;

    if (!secret) {
      console.error('Paystack secret key is missing');
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Webhook Error');
    }

    // Use rawBody if available (enabled in main.ts), otherwise fallback to JSON.stringify
    const payload = (req as any).rawBody || JSON.stringify(body);

    const hash = crypto
      .createHmac('sha512', secret)
      .update(payload)
      .digest('hex');

    if (hash !== signature) {
      throw new BadRequestException('Invalid signature');
    }

    // Process event asynchronously to avoid timeout
    this.subscriptionService.handleWebhook(body).catch((err) => {
      console.error('Error processing webhook:', err);
    });

    return res.status(HttpStatus.OK).send();
  }
}
