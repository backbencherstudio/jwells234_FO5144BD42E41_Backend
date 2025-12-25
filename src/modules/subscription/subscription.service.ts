import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
// import { StripePayment } from '../../common/lib/Payment/stripe/StripePayment';
import { PaystackPayment } from '../../common/lib/Payment/paystack/PaystackPayment';
import appConfig from '../../config/app.config';
import { SubscriptionPlan } from '@prisma/client';
import { CreateProductAndPriceDto } from './dto/createProductAndPrice.dto';
import { ChargeCardDto, SubmitOtpDto } from './dto/ChargeCardDto.dto';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async startTrial(user: any, planId: string) {
    // Check if user has ever used a trial
    const trialUsed = await this.prisma.subscription.findFirst({
      where: {
        userId: user.userId,
        isTrial: true,
      },
    });

    if (trialUsed) {
      throw new BadRequestException('User has already used the trial period');
    }

    // Check for active subscription (prevent overlapping active subscriptions if needed)
    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.userId,
        isActive: true,
      },
    });

    if (
      activeSubscription &&
      activeSubscription.type !== SubscriptionPlan.FREE
    ) {
      throw new BadRequestException('User already has an active subscription');
    }

    const plan = await this.prisma.subsPlan.findFirst({
      where: {
        id: planId,
        type: 'TRIALING',
      },
    });

    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    const trialDays = plan.trialDays || appConfig().subscription.trial_days;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + trialDays);

    // calculate remaining days
    const remainingDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24),
    );

    // If user has a FREE subscription, update it, otherwise create new
    if (activeSubscription) {
      await this.prisma.subscription.update({
        where: { id: activeSubscription.id },
        data: {
          planId: plan.id,
          type: plan.type,
          status: 'trialing',
          isActive: true,
          startDate: startDate,
          endDate: endDate,
          trialEndsAt: endDate,
          remainingDays: remainingDays,
          isTrial: true,
          updatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.subscription.create({
        data: {
          userId: user.userId,
          planId: plan.id,
          type: plan.type,
          status: 'trialing',
          isActive: true,
          startDate: startDate,
          endDate: endDate,
          trialEndsAt: endDate,
          remainingDays: remainingDays,
          isTrial: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      message: `Trial started for ${trialDays} days`,
      data: {
        startDate: startDate,
        endDate: endDate,
      },
    };
  }

  async getSubscriptionStatus(userId: string) {
    // Prioritize finding an ACTIVE subscription
    let subscription = await this.prisma.subscription.findFirst({
      where: {
        userId: userId,
        isActive: true,
      },
    });

    // If no active subscription found, get the latest one (to show canceled/expired status)
    if (!subscription) {
      subscription = await this.prisma.subscription.findFirst({
        where: {
          userId: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    if (!subscription) {
      return {
        success: false,
        plan: SubscriptionPlan.FREE,
        status: 'inactive',
      };
    }

    // Check logic for expiration and remaining days
    if (subscription.isActive && subscription.endDate) {
      const now = new Date();
      if (now > subscription.endDate) {
        // Expired: Downgrade to FREE
        subscription = await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            isActive: false,
            status: 'expired',
            type: SubscriptionPlan.FREE,
            remainingDays: 0,
          },
        });
      } else {
        // Active: Update remaining days
        const remainingDays = Math.ceil(
          (subscription.endDate.getTime() - now.getTime()) / (1000 * 3600 * 24),
        );

        if (remainingDays !== subscription.remainingDays) {
          subscription = await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              remainingDays: remainingDays > 0 ? remainingDays : 0,
            },
          });
        }
      }
    }

    // Optional: Fetch live status from Paystack if it's a recurring subscription
    let paystackStatus = null;
    if (
      subscription.paystackSubId &&
      subscription.paystackSubId.startsWith('SUB_')
    ) {
      try {
        paystackStatus = await PaystackPayment.fetchSubscription(
          subscription.paystackSubId,
        );
      } catch (e) {
        console.warn('Failed to fetch Paystack status', e.message);
      }
    }

    return {
      success: true,
      subscription: subscription,
      paystackDetails: paystackStatus, // Include raw Paystack data
    };
  }

  async createPlanAndPrice(dto: CreateProductAndPriceDto) {
    let paystackPlanId = null;
    let paystackPlanCode = null;

    // Only create Paystack plan if price > 0
    if (dto.price > 0) {
      try {
        const plan = await PaystackPayment.createPlan({
          name: dto.name,
          amount: Math.round(dto.price * 100), // Paystack takes amount in kobo
          interval: dto.interval,
          description: dto.product_description,
        });
        console.log('Created Paystack Plan:', plan);
        paystackPlanId = String(plan.id);
        paystackPlanCode = plan.plan_code;
      } catch (error) {
        console.warn('Skipping Paystack Plan creation (likely free plan or error):', error.message);
      }
    }

    // Map Paystack interval (monthly/annually) to Prisma Interval (MONTH/YEAR)
    let dbInterval: any = 'monthly';
    const interval = dto.interval.toLowerCase();
    if (interval === 'monthly') {
      dbInterval = 'monthly';
    } else if (interval === 'quarterly') {
      dbInterval = 'quarterly';
    } else if (interval === 'biannually') {
      dbInterval = 'biannually';
    } else if (interval === 'annually' || interval === 'yearly') {
      dbInterval = 'annually';
    }

    const productRecord = await this.prisma.subsPlan.create({
      data: {
        paystackPlanId: paystackPlanId,
        paystackPlanCode: paystackPlanCode,
        name: dto.name,
        slug: dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        price: dto.price,
        currency: dto.currency,
        interval: dbInterval,
        intervalCount: dto.interval_count,
        description: dto.product_description,
        price_description: dto.price_description,
        trialDays: dto.trialDays,
        type: dto.type,
      },
    });

    return productRecord;
  }

  async chargeCard(user: any, dto: ChargeCardDto) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!dbUser) {
      throw new BadRequestException('User not found');
    }

    // Check if user already has an active subscription
    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.userId,
        isActive: true,
      },
    });

    if (activeSubscription) {
      // Check if it is expired just in case the status wasn't updated
      const now = new Date();
      if (activeSubscription.endDate && now < activeSubscription.endDate) {
        throw new BadRequestException(
          'User already has an active subscription. Please cancel it before subscribing to a new plan.',
        );
      }
    }

    const plan = await this.prisma.subsPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    // Charge the card
    const charge = await PaystackPayment.chargeCard({
      email: dbUser.email,
      amount: String(Number(plan.price) * 100), // kobo
      card: {
        number: dto.cardNumber,
        cvv: dto.cvv,
        expiry_month: dto.expiryMonth,
        expiry_year: dto.expiryYear,
      },
      pin: dto.pin,
      plan: plan.paystackPlanCode, // This ensures it's a subscription
      metadata: {
        planId: plan.id,
        userId: user.userId,
      },
    });

    if (charge.status === 'success') {
      await this.activateSubscription(user.userId, plan.id, charge);
    }

    return {
      success: true,
      message: charge.status,
      data: charge,
      reference: charge.reference,
      requiresOtp:
        charge.status === 'send_otp' ||
        charge.status === 'send_pin' ||
        charge.status === 'open_url',
    };
  }

  async submitOtp(dto: SubmitOtpDto) {
    const result = await PaystackPayment.submitOtp({
      otp: dto.otp,
      reference: dto.reference,
    });

    if (result.status === 'success') {
      try {
        // Fetch transaction to get metadata
        const transaction = await PaystackPayment.verifyTransaction(
          dto.reference,
        );
        if (
          transaction.metadata &&
          transaction.metadata.planId &&
          transaction.metadata.userId
        ) {
          await this.activateSubscription(
            transaction.metadata.userId,
            transaction.metadata.planId,
            transaction,
          );
        }
      } catch (e) {
        console.error('Error activating subscription after OTP:', e);
      }
    }

    return {
      success: true,
      message: result.status,
      data: result,
    };
  }

  private async activateSubscription(
    userId: string,
    planId: string,
    transaction: any,
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!dbUser) return; // Should not happen

    const plan = await this.prisma.subsPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) return;

    // Calculate next billing date
    const startDate = new Date();
    if (plan.interval === 'monthly') {
      startDate.setMonth(startDate.getMonth() + (plan.intervalCount || 1));
    } else if (plan.interval === 'quarterly') {
      startDate.setMonth(startDate.getMonth() + (plan.intervalCount || 3));
    } else if (plan.interval === 'biannually') {
      startDate.setMonth(startDate.getMonth() + (plan.intervalCount || 6));
    } else if (plan.interval === 'annually') {
      startDate.setFullYear(
        startDate.getFullYear() + (plan.intervalCount || 1),
      );
  }

    let paystackSubCode = null;
    let paystackEmailToken = null;

    try {
      // Create Subscription on Paystack (Future Start Date)
      // This ensures auto-renewal works
      const sub = await PaystackPayment.createSubscription({
        customer: transaction.customer.customer_code || dbUser.email,
        plan: plan.paystackPlanCode,
        authorization: transaction.authorization.authorization_code,
        start_date: startDate.toISOString(),
      });
      paystackSubCode = sub.subscription_code;
      paystackEmailToken = sub.email_token;
    } catch (e) {
      console.warn('Failed to create Paystack subscription:', e.message);

      // Handle duplicate subscription (User already subscribed to this plan)
      if (
        e.message.includes('already in place') ||
        e.message.includes('duplicate')
      ) {
        try {
          // Fetch existing subscription
          // We need Paystack Customer ID and Plan ID (integers)
          const customerId = transaction.customer.id;
          const planId = Number(plan.paystackPlanId);

          if (customerId && planId) {
            const subscriptions = await PaystackPayment.listSubscriptions({
              customer: customerId,
              plan: planId,
            });

            // Find the active one
            const activeSub = subscriptions.find(
              (s) => s.status === 'active' || s.status === 'non-renewing',
            );
            if (activeSub) {
              paystackSubCode = activeSub.subscription_code;
              paystackEmailToken = activeSub.email_token;
              console.log(
                'Found existing Paystack subscription:',
                paystackSubCode,
              );
            }
          }
        } catch (fetchErr) {
          console.warn(
            'Failed to fetch existing subscription:',
            fetchErr.message,
          );
        }
      }
    }

    // Update Local DB
    const existingSub = await this.prisma.subscription.findFirst({
      where: { userId: dbUser.id },
    });

    const subData = {
      userId: dbUser.id,
      isActive: true,
      plan: { connect: { id: plan.id } },
      startDate: new Date(), // Active now
      endDate: startDate, // Valid until next billing
      trialEndsAt: null,
      paystackSubId: paystackSubCode || `paystack_ref_${transaction.reference}`,
      paystackEmailToken: paystackEmailToken,
      cancelAtPeriodEnd: false,
      status: 'active',
      type: plan.type,
      isTrial: false,
      updatedAt: new Date(),
    };

    if (existingSub) {
      await this.prisma.subscription.update({
        where: { id: existingSub.id },
        data: subData,
      });
    } else {
      await this.prisma.subscription.create({
        data: {
          ...subData,
          createdAt: new Date(),
        },
      });
    }
  }

  async getAllPlans() {
    const plans = await this.prisma.subsPlan.findMany({
      orderBy: { price: 'asc' },
    });
    return {
      success: true,
      plans: plans,
    };
  }

  async cancelSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId: userId,
        isActive: true,
      },
    });

    if (!subscription) {
      throw new BadRequestException('No active subscription found');
    }

    try {
      if (
        subscription.paystackSubId &&
        subscription.paystackSubId.startsWith('SUB_')
      ) {
        let token = subscription.paystackEmailToken;

        if (!token) {
          try {
            const subDetails = await PaystackPayment.fetchSubscription(
              subscription.paystackSubId,
            );
            if (subDetails) token = subDetails.email_token;
          } catch (e) {
            console.warn(
              'Could not fetch Paystack subscription details:',
              e.message,
            );
          }
        }

        if (token) {
          try {
            await PaystackPayment.disableSubscription({
              code: subscription.paystackSubId,
              token: token,
            });
          } catch (e) {
            console.warn(
              'Could not cancel Paystack subscription remotely:',
              e.message,
            );
          }
        }
      }

      // Update local DB
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          isActive: false,
          status: 'canceled',
          cancelAtPeriodEnd: true,
        },
      });

      return {
        success: true,
        message: 'Subscription canceled successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to cancel subscription: ' + error.message,
      );
    }
  }

  async handleWebhook(event: any) {
    console.log('Paystack Webhook Event:', event.event);

    switch (event.event) {
      case 'subscription.create':
        await this.handleSubscriptionCreate(event.data);
        break;
      case 'charge.success':
        await this.handleChargeSuccess(event.data);
        break;
      case 'subscription.disable':
        await this.handleSubscriptionDisable(event.data);
        break;
      default:
        console.log('Unhandled event:', event.event);
    }
  }

  private async handleSubscriptionCreate(data: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.customer.email },
    });
    if (!user) return;

    // Update the subscription with the real subscription code and email token
    const sub = await this.prisma.subscription.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (sub) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          paystackSubId: data.subscription_code,
          paystackEmailToken: data.email_token,
        },
      });
    }
  }

  private async handleChargeSuccess(data: any) {
    // Only process if it's a subscription renewal (has plan)
    if (!data.plan) return;

    const user = await this.prisma.user.findUnique({
      where: { email: data.customer.email },
    });
    if (!user) return;

    const sub = await this.prisma.subscription.findFirst({
      where: { userId: user.id, isActive: true },
      include: { plan: true },
    });

    if (sub) {
      // Calculate new end date based on plan interval
      const currentPeriodEnd = new Date();
      if (sub.plan.interval === 'monthly') {
        currentPeriodEnd.setMonth(
          currentPeriodEnd.getMonth() + (sub.plan.intervalCount || 1),
        );
      } else if (sub.plan.interval === 'quarterly') {
        currentPeriodEnd.setMonth(
          currentPeriodEnd.getMonth() + (sub.plan.intervalCount || 3),
        );
      } else if (sub.plan.interval === 'biannually') {
        currentPeriodEnd.setMonth(
          currentPeriodEnd.getMonth() + (sub.plan.intervalCount || 6),
        );
      } else if (sub.plan.interval === 'annually') {
        currentPeriodEnd.setFullYear(
          currentPeriodEnd.getFullYear() + (sub.plan.intervalCount || 1),
        );
      }

      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          endDate: currentPeriodEnd,
          status: 'active',
        },
      });
    }
  }

  private async handleSubscriptionDisable(data: any) {
    const sub = await this.prisma.subscription.findFirst({
      where: { paystackSubId: data.subscription_code },
    });

    if (sub) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          isActive: false,
          status: 'canceled',
        },
      });
    }
  }
}
