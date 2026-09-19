import { Controller, Get, Post, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
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
  async startTrial(
    @GetUser() user,
    @Body('planId') planId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.subscriptionService.startTrial(user, planId);
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to start trial',
      };
    }
  }

  @ApiOperation({ summary: 'create product & price' })
  @Post('create-plan-price')
  async createPlanAndPrice(
    @Body() dto: CreateProductAndPriceDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.subscriptionService.createPlanAndPrice(dto);
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to create plan and price',
      };
    }
  }

  @ApiOperation({ summary: 'Charge Card Directly (Custom Checkout)' })
  @Post('payment/charge')
  async chargeCard(
    @GetUser() user,
    @Body() dto: ChargeCardDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.subscriptionService.chargeCard(user, dto);
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to charge card',
      };
    }
  }

  @ApiOperation({ summary: 'Submit OTP for Charge' })
  @Post('payment/otp')
  async submitOtp(
    @Body() dto: SubmitOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.subscriptionService.submitOtp(dto);
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to submit OTP',
      };
    }
  }

  @ApiOperation({ summary: 'Get User Subscription Status' })
  @Get('status')
  async getSubscriptionStatus(
    @GetUser() user,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.subscriptionService.getSubscriptionStatus(
        user.userId,
      );
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to get subscription status',
      };
    }
  }

  @ApiOperation({ summary: 'get all plans' })
  @Get('plans')
  async getAllPlans(@Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.subscriptionService.getAllPlans();
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to get plans',
      };
    }
  }

  @ApiOperation({ summary: 'Cancel Subscription' })
  @Post('cancel')
  async cancelSubscription(
    @GetUser('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.subscriptionService.cancelSubscription(userId);
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to cancel subscription',
      };
    }
  }
}
