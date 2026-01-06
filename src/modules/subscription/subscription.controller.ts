import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateProductAndPriceDto } from './dto/createProductAndPrice.dto';
import { ChargeCardDto, SubmitOtpDto } from './dto/ChargeCardDto.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('subscription')
@Controller('subscription')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // @ApiOperation({ summary: 'Create Stripe Checkout Session for Subscription' })
  // @Post('checkout')
  // createCheckoutSession(
  //   @Req() req,
  //   @Body() createSubscriptionDto: CreateSubscriptionDto,
  // ) {
  //   return this.subscriptionService.createCheckoutSession(
  //     req.user,
  //     createSubscriptionDto,
  //   );
  // }

  @ApiOperation({ summary: 'Start Trial Subscription' })
  @Post('start-trial')
  async startTrial(@GetUser() user, @Body('planId') planId: string) {
    try {
      return await this.subscriptionService.startTrial(user, planId);
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to start trial',
      };
    }
  }

  @ApiOperation({ summary: 'create product & price' })
  @Post('create-plan-price')
  async createPlanAndPrice(@Body() dto: CreateProductAndPriceDto) {
    try {
      return await this.subscriptionService.createPlanAndPrice(dto);
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to create plan and price',
      };
    }
  }

  @ApiOperation({ summary: 'Charge Card Directly (Custom Checkout)' })
  @Post('payment/charge')
  async chargeCard(@GetUser() user, @Body() dto: ChargeCardDto) {
    try {
      return await this.subscriptionService.chargeCard(user, dto);
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to charge card',
      };
    }
  }

  @ApiOperation({ summary: 'Submit OTP for Charge' })
  @Post('payment/otp')
  async submitOtp(@Body() dto: SubmitOtpDto) {
    try {
      return await this.subscriptionService.submitOtp(dto);
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to submit OTP',
      };
    }
  }

  @ApiOperation({ summary: 'Get User Subscription Status' })
  @Get('status')
  async getSubscriptionStatus(@GetUser() user) {
    try {
      return await this.subscriptionService.getSubscriptionStatus(user.userId);
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to get subscription status',
      };
    }
  }

  @ApiOperation({ summary: 'get all plans' })
  @Get('plans')
  async getAllPlans() {
    try {
      return await this.subscriptionService.getAllPlans();
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to get plans',
      };
    }
  }

  @ApiOperation({ summary: 'Cancel Subscription' })
  @Post('cancel')
  async cancelSubscription(@GetUser('userId') userId: string) {
    try {
      return await this.subscriptionService.cancelSubscription(userId);
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to cancel subscription',
      };
    }
  }
}
