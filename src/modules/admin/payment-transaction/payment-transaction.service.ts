import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PaymentTransactionService {
  constructor(private prisma: PrismaService) {}

  async getAnalytics() {
    // 1. Total Payment Amount
    const totalPaymentAgg = await this.prisma.paymentTransaction.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: 'success',
      },
    });

    // 2. Paid Users (Unique users who have made a payment)
    const paidUsersCount = await this.prisma.paymentTransaction.groupBy({
      by: ['user_id'],
      where: {
        status: 'success',
        user_id: { not: null },
      },
    });

    // 3. Breakdown by Provider (Debit/Credit, Internet Banking, etc.)
    const providerStats = await this.prisma.paymentTransaction.groupBy({
      by: ['provider'],
      _sum: {
        amount: true,
      },
      _count: {
        user_id: true, // Approximate users per provider
      },
      where: {
        status: 'success',
      },
    });

    // 4. total cancelled/refunded payments could be added similarly
    const cancelledRefundedAgg = await this.prisma.paymentTransaction.aggregate(
      {
        _sum: {
          amount: true,
        },
        where: {
          status: { in: ['cancelled', 'refunded'] },
        },
      },
    );

    const cancelledRefundedUsersCount =
      await this.prisma.paymentTransaction.groupBy({
        by: ['user_id'],
        where: {
          status: { in: ['cancelled', 'refunded'] },
          user_id: { not: null },
        },
      });

    return {
      totalPayment: totalPaymentAgg._sum.amount || 0,
      paidUsers: paidUsersCount.length,
      breakdown: providerStats.map((stat) => ({
        provider: stat.provider || 'Unknown',
        amount: stat._sum.amount || 0,
        users: stat._count.user_id,
      })),
      totalCancelledRefunded: cancelledRefundedAgg._sum.amount || 0,
      cancelledRefundedUsers: cancelledRefundedUsersCount.length,
    };
  }

  async findAll(query: PaymentQueryDto) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentTransactionWhereInput = {};

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, transactions] = await Promise.all([
      this.prisma.paymentTransaction.count({ where }),
      this.prisma.paymentTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const userIds = transactions
      .map((t) => t.user_id)
      .filter((id) => id !== null) as string[];

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        userId: { in: userIds },
      },
      include: {
        plan: true,
      },
    });

    // Map userId to subscription
    const subMap = new Map();
    subscriptions.forEach((sub) => {
      subMap.set(sub.userId, sub);
    });

    // Transform to match UI needs
    const data = transactions.map((tx) => {
      const sub = tx.user_id ? subMap.get(tx.user_id) : null;
      return {
        id: tx.id,
        transactionId: tx.reference_number || tx.id, // Use reference if available
        date: tx.created_at,
        status: tx.status, // Transaction status
        amount: tx.amount,
        currency: tx.currency,
        provider: tx.provider,
        type: tx.type,
        user: {
          id: tx.user?.id,
          name: tx.user?.name,
          username: tx.user?.username,
          avatar: tx.user?.avatar,
          email: tx.user?.email,
        },
        plan: {
          name: sub?.plan?.name || 'N/A',
          interval: sub?.plan?.interval || 'N/A',
          price: sub?.plan?.price || 0,
        },
        // paymentPlan: sub?.plan?.name || 'N/A', // Current plan
        subscriptionStatus: sub?.isActive ? 'Active' : 'Inactive',
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar: true,
            country: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    let subscription = null;
    // Manually fetch subscription if user exists
    if (transaction.user_id) {
      subscription = await this.prisma.subscription.findFirst({
        where: { userId: transaction.user_id },
        include: { plan: true },
      });
    }

    return {
      id: transaction.id,
      transactionId: transaction.reference_number || transaction.id,
      date: transaction.created_at,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      provider: transaction.provider,
      type: transaction.type,
      user: transaction.user,
      subscription: subscription
        ? {
            plan: subscription.plan?.name,
            status: subscription.isActive ? 'Active' : 'Inactive',
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            interval: subscription.plan?.interval,
            price: subscription.plan?.price,
          }
        : null,
    };
  }
}
