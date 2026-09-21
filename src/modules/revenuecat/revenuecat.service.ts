import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RevenueCatEventDto } from './dto/revenuecat-webhook.dto';
import { SubscriptionPlan } from '@prisma/client';
import { NotificationService } from '../application/notification/notification.service';

/** Canonical plan slugs stored in SubsPlan.slug */
export const RC_PLAN_SLUGS = {
  oneMonth: 'john.example.jwells.one_month',
  threeMonths: 'john.example.jwells.three_months',
  sixMonths: 'john.example.jwells.six_months',
  oneYear: 'john.example.jwells.one_year',
  free: 'free',
} as const;

/**
 * Maps every known App Store / Play Store / Test Store / entitlement ID
 * (including the RC dashboard typo `jwell`) onto a SubsPlan.slug.
 */
const PRODUCT_TO_SLUG: Record<string, string> = {
  // App Store product IDs + entitlements
  'john.example.jwells.one_month': RC_PLAN_SLUGS.oneMonth,
  'john.example.jwells.three_months': RC_PLAN_SLUGS.threeMonths,
  'john.example.jwell.three_months': RC_PLAN_SLUGS.threeMonths, // RC typo
  'john.example.jwells.six_months': RC_PLAN_SLUGS.sixMonths,
  'john.example.jwells.one_year': RC_PLAN_SLUGS.oneYear,
  // Play Store product IDs
  'sw-1-month-base': RC_PLAN_SLUGS.oneMonth,
  'sw_premium_1month': RC_PLAN_SLUGS.oneMonth,
  'sw-premium-1month': RC_PLAN_SLUGS.oneMonth,
  'sw-premium-3month': RC_PLAN_SLUGS.threeMonths,
  'sw_premium_3month': RC_PLAN_SLUGS.threeMonths,
  'sw-premium-6month': RC_PLAN_SLUGS.sixMonths,
  'sw_premium_6month': RC_PLAN_SLUGS.sixMonths,
  'sw-premium-1year': RC_PLAN_SLUGS.oneYear,
  'sw_premium_1year': RC_PLAN_SLUGS.oneYear,
  // RevenueCat Test Store
  one_month: RC_PLAN_SLUGS.oneMonth,
  three_month: RC_PLAN_SLUGS.threeMonths,
  six_month: RC_PLAN_SLUGS.sixMonths,
  yearly: RC_PLAN_SLUGS.oneYear,
  // Free / trial entitlement
  sw_free: RC_PLAN_SLUGS.oneMonth,
};

export type SyncSubscriptionDto = {
  productId?: string;
  entitlementIds?: string[];
  purchasedAtMs?: number;
  expirationAtMs?: number;
  transactionId?: string;
  store?: string;
  periodType?: string;
};

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async handleWebhook(event: RevenueCatEventDto) {
    this.logger.log(
      `Handling RevenueCat event: ${event.type} for user: ${event.app_user_id}`,
    );

    if (event.type === 'TRANSFER') {
      return this.handleTransfer(event);
    }

    const user = await this.resolveUser(event);
    if (!user) {
      this.logger.warn(
        `User not found for app_user_id=${event.app_user_id}, original=${event.original_app_user_id}. Skipping.`,
      );
      // Do not throw — RC would retry forever for anonymous IDs with no DB user.
      return { success: false, message: 'User not found' };
    }

    const plan = await this.resolvePlan(event);
    if (!plan) {
      this.logger.error(
        `No SubsPlan available in DB for product_id=${event.product_id}, entitlements=${JSON.stringify(event.entitlement_ids)}`,
      );
      throw new BadRequestException('No SubsPlan available in DB');
    }

    console.log('plains --->', await this.prisma.subsPlan.findMany())
    console.log('subscriptions --->', await this.prisma.subscription.findMany())


    const purchasedAt = event.purchased_at_ms
      ? new Date(event.purchased_at_ms)
      : new Date();
    const expiresAt = event.expiration_at_ms
      ? new Date(event.expiration_at_ms)
      : null;
    const isTrial = event.period_type === 'TRIAL';

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'PRODUCT_CHANGE':
      case 'NON_RENEWING_PURCHASE':
      case 'SUBSCRIPTION_EXTENDED':
      case 'TEMPORARY_ENTITLEMENT_GRANT': {
        await this.activateSubscription({
          userId: user.id,
          plan,
          purchasedAt,
          expiresAt,
          isTrial,
          event,
          recordPayment: ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE'].includes(
            event.type,
          ),
        });
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
          this.logger.log(
            `Subscription ${existingSub.id} marked as cancelled for user ${user.id}`,
          );

          try {
            await this.notificationService.createNotification({
              receiver_id: user.id,
              type: 'SUBSCRIPTION_CANCELLED',
              text: 'Your subscription has been cancelled.',
              entity_id: existingSub.planId,
            });
          } catch (err) {
            this.logger.error(
              `Failed to send subscription cancelled notification for user ${user.id}: ${err.message}`,
            );
          }
        } else {
          this.logger.warn(
            `No active subscription found to cancel for user ${user.id}`,
          );
        }
        break;
      }

      case 'EXPIRATION':
      case 'BILLING_ISSUE': {
        await this.deactivateSubscription(user.id, event.type.toLowerCase());
        break;
      }

      default:
        this.logger.log(`Unhandled RevenueCat event type: ${event.type}`);
        break;
    }

    return { success: true };
  }

  /**
   * Client-side repair: after a successful store purchase/restore, the app
   * can call this so premium unlocks even if the webhook is delayed/misconfigured.
   */
  async syncFromClient(userId: string, dto: SyncSubscriptionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const fakeEvent = {
      id: dto.transactionId || `sync_${Date.now()}`,
      type: 'INITIAL_PURCHASE',
      app_user_id: userId,
      product_id: dto.productId || '',
      entitlement_ids: dto.entitlementIds || [],
      purchased_at_ms: dto.purchasedAtMs || Date.now(),
      expiration_at_ms: dto.expirationAtMs,
      period_type: dto.periodType,
      store: dto.store,
      transaction_id: dto.transactionId,
    } as RevenueCatEventDto;

    const plan = await this.resolvePlan(fakeEvent);
    if (!plan) {
      throw new BadRequestException(
        `No SubsPlan for productId=${dto.productId}, entitlements=${JSON.stringify(dto.entitlementIds)}`,
      );
    }

    const subscription = await this.activateSubscription({
      userId: user.id,
      plan,
      purchasedAt: new Date(fakeEvent.purchased_at_ms),
      expiresAt: fakeEvent.expiration_at_ms
        ? new Date(fakeEvent.expiration_at_ms)
        : null,
      isTrial: dto.periodType === 'TRIAL',
      event: fakeEvent,
      recordPayment: true,
    });

    return {
      success: true,
      statusCode: 200,
      message: 'Subscription synced',
      data: { subscriptionId: subscription.id, premium: true },
    };
  }

  private async handleTransfer(event: RevenueCatEventDto) {
    const toIds = (event.transferred_to?.length
      ? event.transferred_to
      : [event.app_user_id]
    ).filter(Boolean);

    const fromIds = (event.transferred_from || []).filter(Boolean);

    this.logger.log(
      `TRANSFER from=${JSON.stringify(fromIds)} to=${JSON.stringify(toIds)}`,
    );

    for (const fromId of fromIds) {
      if (fromId.startsWith('$RCAnonymousID:')) continue;
      const fromUser = await this.prisma.user.findUnique({
        where: { id: fromId },
      });
      if (fromUser) {
        await this.deactivateSubscription(fromUser.id, 'transferred_away');
      }
    }

    const plan = await this.resolvePlan(event);
    if (!plan) {
      // Transfers sometimes omit product_id — fall back to any premium plan.
      const fallback = await this.prisma.subsPlan.findFirst({
        where: { NOT: { type: SubscriptionPlan.FREE } },
      });
      if (!fallback) {
        throw new BadRequestException('No SubsPlan available in DB');
      }
      for (const toId of toIds) {
        if (toId.startsWith('$RCAnonymousID:')) continue;
        const toUser = await this.prisma.user.findUnique({
          where: { id: toId },
        });
        if (!toUser) {
          this.logger.warn(`TRANSFER target user not found: ${toId}`);
          continue;
        }
        await this.activateSubscription({
          userId: toUser.id,
          plan: fallback,
          purchasedAt: event.purchased_at_ms
            ? new Date(event.purchased_at_ms)
            : new Date(),
          expiresAt: event.expiration_at_ms
            ? new Date(event.expiration_at_ms)
            : null,
          isTrial: event.period_type === 'TRIAL',
          event,
          recordPayment: false,
        });
      }
      return { success: true };
    }

    for (const toId of toIds) {
      if (toId.startsWith('$RCAnonymousID:')) continue;
      const toUser = await this.prisma.user.findUnique({
        where: { id: toId },
      });
      if (!toUser) {
        this.logger.warn(`TRANSFER target user not found: ${toId}`);
        continue;
      }
      await this.activateSubscription({
        userId: toUser.id,
        plan,
        purchasedAt: event.purchased_at_ms
          ? new Date(event.purchased_at_ms)
          : new Date(),
        expiresAt: event.expiration_at_ms
          ? new Date(event.expiration_at_ms)
          : null,
        isTrial: event.period_type === 'TRIAL',
        event,
        recordPayment: false,
      });
    }

    return { success: true };
  }

  private async resolveUser(event: RevenueCatEventDto) {
    const candidates = [
      event.app_user_id,
      event.original_app_user_id,
      ...(event.aliases || []),
    ].filter(
      (id): id is string =>
        !!id && !id.startsWith('$RCAnonymousID:'),
    );

    for (const id of candidates) {
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (user) return user;
    }
    return null;
  }

  private async resolvePlan(event: RevenueCatEventDto) {
    const candidates = [
      event.product_id,
      event.entitlement_id,
      ...(event.entitlement_ids || []),
      event.new_product_id,
    ]
      .filter(Boolean)
      .map((id) => String(id));

    const slugs = new Set<string>();
    for (const id of candidates) {
      const lower = id.toLowerCase();
      slugs.add(lower);
      const mapped = PRODUCT_TO_SLUG[id] || PRODUCT_TO_SLUG[lower];
      if (mapped) slugs.add(mapped);
    }

    if (slugs.size === 0) {
      return this.prisma.subsPlan.findFirst({
        where: { NOT: { type: SubscriptionPlan.FREE } },
      });
    }

    const slugList = [...slugs];
    let plan = await this.prisma.subsPlan.findFirst({
      where: {
        OR: [
          { slug: { in: slugList } },
          { id: { in: candidates } },
          { stripeProductId: { in: candidates } },
        ],
      },
    });

    if (!plan) {
      this.logger.warn(
        `No SubsPlan matching ${JSON.stringify(candidates)}. Falling back to any non-FREE plan.`,
      );
      plan = await this.prisma.subsPlan.findFirst({
        where: { NOT: { type: SubscriptionPlan.FREE } },
      });
    }

    return plan;
  }

  private async activateSubscription(params: {
    userId: string;
    plan: { id: string; name: string; type: SubscriptionPlan; price: any; currency: string | null };
    purchasedAt: Date;
    expiresAt: Date | null;
    isTrial: boolean;
    event: RevenueCatEventDto;
    recordPayment: boolean;
  }) {
    const { userId, plan, purchasedAt, expiresAt, isTrial, event, recordPayment } =
      params;

    let remainingDays = 0;
    if (expiresAt) {
      remainingDays = Math.ceil(
        (expiresAt.getTime() - Date.now()) / (1000 * 3600 * 24),
      );
      if (remainingDays < 0) remainingDays = 0;
    }

    const subscriptionType = plan.type || SubscriptionPlan.PREMIUM;
    const existingSub = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { startDate: 'desc' },
    });

    const subData = {
      planId: plan.id,
      type: subscriptionType,
      status: isTrial ? 'trialing' : 'active',
      isActive: true,
      startDate: purchasedAt,
      endDate: expiresAt,
      trialEndsAt: isTrial ? expiresAt : null,
      remainingDays,
      isTrial,
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    };

    let subscription;
    if (existingSub) {
      subscription = await this.prisma.subscription.update({
        where: { id: existingSub.id },
        data: subData,
      });
    } else {
      subscription = await this.prisma.subscription.create({
        data: {
          ...subData,
          userId,
          createdAt: new Date(),
        },
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionId: subscription.id },
    });

    this.logger.log(
      `Activated subscription ${subscription.id} for user ${userId} (plan=${plan.id}, event=${event.type})`,
    );

    console.log('plains --->', await this.prisma.subsPlan.findMany())
    console.log('subscriptions --->', await this.prisma.subscription.findMany())


    if (recordPayment) {
      try {
        await this.prisma.paymentTransaction.create({
          data: {
            user_id: userId,
            amount:
              event.price !== undefined && event.price !== null
                ? event.price
                : plan.price
                  ? Number(plan.price)
                  : 0,
            currency: event.currency || plan.currency || 'USD',
            paid_amount:
              event.price_in_purchased_currency !== undefined &&
              event.price_in_purchased_currency !== null
                ? event.price_in_purchased_currency
                : event.price !== undefined && event.price !== null
                  ? event.price
                  : plan.price
                    ? Number(plan.price)
                    : 0,
            paid_currency: event.currency || plan.currency || 'USD',
            reference_number: event.transaction_id || event.id,
            status: 'success',
            provider: 'revenuecat',
            type:
              event.type === 'RENEWAL'
                ? 'subscription_renewal'
                : 'subscription',
            raw_status: JSON.stringify(event),
            store_id: event.store,
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to record payment transaction: ${error.message}`,
        );
      }
    }

    try {
      if (event.type === 'RENEWAL') {
        await this.notificationService.createNotification({
          receiver_id: userId,
          type: 'SUBSCRIPTION_RENEWED',
          text: `Your subscription has been renewed successfully.`,
          entity_id: plan.id,
        });
      } else if (
        ['INITIAL_PURCHASE', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'TRANSFER'].includes(
          event.type,
        )
      ) {
        await this.notificationService.createNotification({
          receiver_id: userId,
          type: 'SUBSCRIPTION_ACTIVATED',
          text: `Your subscription to ${plan.name} has been activated successfully.`,
          entity_id: plan.id,
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to send subscription notification for user ${userId}: ${err.message}`,
      );
    }

    return subscription;
  }

  private async deactivateSubscription(userId: string, reason: string) {
    const existingSub = await this.prisma.subscription.findFirst({
      where: { userId, isActive: true },
      orderBy: { startDate: 'desc' },
    });

    if (!existingSub) {
      this.logger.warn(
        `No active subscription to deactivate for user ${userId} (${reason})`,
      );
      return;
    }

    await this.prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        isActive: false,
        status: reason === 'transferred_away' ? 'transferred' : 'expired',
        remainingDays: 0,
        updatedAt: new Date(),
      },
    });
    this.logger.log(
      `Subscription ${existingSub.id} deactivated for user ${userId} (${reason})`,
    );
  }
}
