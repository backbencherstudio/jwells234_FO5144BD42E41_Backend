import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RevenueCatService } from './revenuecat.service';
import { RevenueCatWebhookDto } from './dto/revenuecat-webhook.dto';
import appConfig from '../../config/app.config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('revenuecat')
@Controller('revenuecat')
export class RevenueCatController {
  constructor(private readonly revenueCatService: RevenueCatService) { }

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
      throw new UnauthorizedException('RevenueCat webhook secret is not configured on server');
    }

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    // Extract Bearer token
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (token !== configSecret) {
      throw new UnauthorizedException('Invalid Authorization token');
    }

    console.log(body)
    // Delegate handling of the event object to the service
    await this.revenueCatService.handleWebhook(body.event);

    return { received: true };
  }
}
