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
  startTrial(@GetUser() user, @Body('planId') planId: string) {
    return this.subscriptionService.startTrial(user, planId);
  }

  @ApiOperation({ summary: 'create product & price' })
  @Post('create-plan-price')
  createPlanAndPrice(@Body() dto: CreateProductAndPriceDto) {
    return this.subscriptionService.createPlanAndPrice(dto);
  }

  @ApiOperation({ summary: 'Charge Card Directly (Custom Checkout)' })
  @Post('payment/charge')
  chargeCard(@GetUser() user, @Body() dto: ChargeCardDto) {
    return this.subscriptionService.chargeCard(user, dto);
  }

  @ApiOperation({ summary: 'Submit OTP for Charge' })
  @Post('payment/otp')
  submitOtp(@Body() dto: SubmitOtpDto) {
    return this.subscriptionService.submitOtp(dto);
  }

  @ApiOperation({ summary: 'Get User Subscription Status' })
  @Get('status')
  getSubscriptionStatus(@GetUser() user) {
    return this.subscriptionService.getSubscriptionStatus(user.userId);
  }

  @ApiOperation({ summary: 'get all plans' })
  @Get('plans')
  getAllPlans() {
    return this.subscriptionService.getAllPlans();
  }

  @ApiOperation({ summary: 'Cancel Subscription' })
  @Post('cancel')
  cancelSubscription(@GetUser('userId') userId: string) {
    return this.subscriptionService.cancelSubscription(userId);
  }
}
