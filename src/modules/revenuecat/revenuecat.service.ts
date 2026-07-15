import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RevenueCatEventDto } from './dto/revenuecat-webhook.dto';
import { SubscriptionPlan } from '@prisma/client';
import { NotificationService } from '../application/notification/notification.service';

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { }

  async handleWebhook(event: RevenueCatEventDto) {
    this.logger.log(`Handling RevenueCat event: ${event.type} for user: ${event.app_user_id}`);

    // 1. Verify User exists
    const user = await this.prisma.user.findUnique({
      where: { id: event.app_user_id },
    });

    if (!user) {
      this.logger.warn(`User with ID ${event.app_user_id} not found in database. Skipping event.`);
      return { success: false, message: 'User not found' };
    }

    // 2. Find SubsPlan matching the product_id (slug)
    let plan = await this.prisma.subsPlan.findFirst({
      where: {
        OR: [
          { slug: event.product_id.toLowerCase() },
          { id: event.product_id },
          { stripeProductId: event.product_id },
        ],
      },
    });

    if (!plan) {
      this.logger.warn(`No SubsPlan found matching product_id: ${event.product_id}. Attempting to use default plan.`);
      // Fallback to first premium or available plan
      plan = await this.prisma.subsPlan.findFirst({
        where: { NOT: { type: SubscriptionPlan.FREE } }
      });
      if (!plan) {
        plan = await this.prisma.subsPlan.findFirst();
      }
    }

    if (!plan) {
      this.logger.error(`No plans available in database to associate subscription.`);
      return { success: false, message: 'No plans found in database' };
    }

    const purchasedAt = new Date(event.purchased_at_ms);
    const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
    const isTrial = event.period_type === 'TRIAL';

    // Calculate remaining days
    let remainingDays = 0;
    if (expiresAt) {
      const now = new Date();
      remainingDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 3600 * 24));
      if (remainingDays < 0) remainingDays = 0;
    }

    // Determine type for subscription
    const subscriptionType = plan.type || SubscriptionPlan.PREMIUM;

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'TRANSFER': {
        // Upsert subscription
        const existingSub = await this.prisma.subscription.findFirst({
          where: { userId: user.id },
          orderBy: { startDate: 'desc' },
        });

        let subscription;
        const subData = {
          planId: plan.id,
          type: subscriptionType,
          status: isTrial ? 'trialing' : 'active',
          isActive: true,
          startDate: purchasedAt,
          endDate: expiresAt,
          trialEndsAt: isTrial ? expiresAt : null,
          remainingDays: remainingDays,
          isTrial: isTrial,
          cancelAtPeriodEnd: false,
          updatedAt: new Date(),
        };

        if (existingSub) {
          subscription = await this.prisma.subscription.update({
            where: { id: existingSub.id },
            data: subData,
          });
        } else {
          subscription = await this.prisma.subscription.create({
            data: {
              ...subData,
              userId: user.id,
              createdAt: new Date(),
            },
          });
        }

        // Link subscription to user
        await this.prisma.user.update({
          where: { id: user.id },
          data: { subscriptionId: subscription.id },
        });

        this.logger.log(`Successfully activated/renewed subscription ${subscription.id} for user ${user.id}`);

        // Record Payment Transaction
        try {
          await this.prisma.paymentTransaction.create({
            data: {
              user_id: user.id,
              amount: event.price !== undefined && event.price !== null ? event.price : (plan.price ? Number(plan.price) : 0),
              currency: event.currency || plan.currency || 'USD',
              paid_amount: event.price_in_purchased_currency !== undefined && event.price_in_purchased_currency !== null ? event.price_in_purchased_currency : (event.price !== undefined && event.price !== null ? event.price : (plan.price ? Number(plan.price) : 0)),
              paid_currency: event.currency || plan.currency || 'USD',
              reference_number: event.transaction_id || event.id,
              status: 'success',
              provider: 'revenuecat',
              type: event.type === 'RENEWAL' ? 'subscription_renewal' : 'subscription',
              raw_status: JSON.stringify(event),
              store_id: event.store,
            },
          });
          this.logger.log(`Recorded payment transaction for user ${user.id} from RevenueCat webhook`);
        } catch (error) {
          this.logger.error(`Failed to record payment transaction: ${error.message}`);
        }

        // Send Notification
        try {
          if (event.type === 'RENEWAL') {
            await this.notificationService.createNotification({
              receiver_id: user.id,
              type: 'SUBSCRIPTION_RENEWED',
              text: `Your subscription has been renewed successfully.`,
              entity_id: plan.id,
            });
          } else {
            await this.notificationService.createNotification({
              receiver_id: user.id,
              type: 'SUBSCRIPTION_ACTIVATED',
              text: `Your subscription to ${plan.name} has been activated successfully.`,
              entity_id: plan.id,
            });
          }
        } catch (err) {
          this.logger.error(`Failed to send subscription notification for user ${user.id}: ${err.message}`);
        }
        break;
      }

      case 'CANCELLATION': {
        const existingSub = await this.prisma.subscription.findFirst({
          where: { userId: user.id, isActive: true },
          orderBy: { startDate: 'desc' },
        });

        if (existingSub) {
          await this.prisma.subscription.update({
            where: { id: existingSub.id },
            data: {
              cancelAtPeriodEnd: true,
              status: 'cancelled',
              updatedAt: new Date(),
            },
          });
          this.logger.log(`Subscription ${existingSub.id} marked as cancelled for user ${user.id}`);

          // Send Notification
          try {
            await this.notificationService.createNotification({
              receiver_id: user.id,
              type: 'SUBSCRIPTION_CANCELLED',
              text: 'Your subscription has been cancelled.',
              entity_id: existingSub.planId,
            });
          } catch (err) {
            this.logger.error(`Failed to send subscription cancelled notification for user ${user.id}: ${err.message}`);
          }
        } else {
          this.logger.warn(`No active subscription found to cancel for user ${user.id}`);
        }
        break;
      }

      case 'EXPIRATION':
      case 'BILLING_ISSUE': {
        const existingSub = await this.prisma.subscription.findFirst({
          where: { userId: user.id, isActive: true },
          orderBy: { startDate: 'desc' },
        });

        if (existingSub) {
          await this.prisma.subscription.update({
            where: { id: existingSub.id },
            data: {
              isActive: false,
              status: 'expired',
              remainingDays: 0,
              updatedAt: new Date(),
            },
          });
          this.logger.log(`Subscription ${existingSub.id} marked as expired/billing_issue for user ${user.id}`);
        } else {
          this.logger.warn(`No active subscription found to expire for user ${user.id}`);
        }
        break;
      }

      default:
        this.logger.log(`Unhandled RevenueCat event type: ${event.type}`);
        break;
    }

    return { success: true };
  }
}
