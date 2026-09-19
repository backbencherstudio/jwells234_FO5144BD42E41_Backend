import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { RevenueCatService } from './revenuecat.service';
import { SyncSubscriptionDto } from './dto/revenuecat-webhook.dto';
import appConfig from '../../config/app.config';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('revenuecat')
@Controller('revenuecat')
export class RevenueCatController {
  constructor(private readonly revenueCatService: RevenueCatService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle RevenueCat Webhook Events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized signature/token' })
  async handleWebhook(
    @Headers('authorization') authHeader: string,
    @Body() body: any,
  ) {
    const configSecret = appConfig().revenuecat.webhook_secret;

    if (!configSecret) {
      throw new UnauthorizedException(
        'RevenueCat webhook secret is not configured on server',
      );
    }

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (token !== configSecret) {
      throw new UnauthorizedException('Invalid Authorization token');
    }

    console.log(
      '[RevenueCat webhook]',
      body?.event?.type,
      body?.event?.app_user_id,
      body?.event?.product_id,
    );

    await this.revenueCatService.handleWebhook(body.event);

    return { received: true };
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Sync active store subscription to backend (fallback when webhook is delayed)',
  })
  async syncSubscription(
    @GetUser() user: { userId: string },
    @Body() body: SyncSubscriptionDto,
  ) {
    return this.revenueCatService.syncFromClient(user.userId, body);
  }
}
