import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserStatus, ReportStatus } from '@prisma/client';
import {
  startOfYear,
  startOfMonth,
  startOfWeek,
  format,
} from 'date-fns';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(period: 'year' | 'month' | 'week' | 'all' = 'year') {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalShouts,
      voiceShouts,
      shoutReports,
      userReports,
      pendingShoutReports,
      pendingUserReports,
      resolvedShoutReports,
      resolvedUserReports,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deleted_at: null } }),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE, deleted_at: null } }),
      this.prisma.user.count({ where: { status: UserStatus.INACTIVE, deleted_at: null } }),
      this.prisma.shout.count({ where: { deleted_at: null } }),
      this.prisma.shout.count({
        where: {
          deleted_at: null,
          medias: {
            some: {
              type: 'AUDIO',
            },
          },
        },
      }),
      this.prisma.shoutReport.count(),
      this.prisma.userReport.count(),
      this.prisma.shoutReport.count({ where: { status: ReportStatus.PENDING } }),
      this.prisma.userReport.count({ where: { status: ReportStatus.PENDING } }),
      this.prisma.shoutReport.count({ where: { status: ReportStatus.RESOLVED } }),
      this.prisma.userReport.count({ where: { status: ReportStatus.RESOLVED } }),
    ]);

    const textShouts = totalShouts - voiceShouts;
    const totalReports = shoutReports + userReports;
    const pendingReports = pendingShoutReports + pendingUserReports;
    const resolvedReports = resolvedShoutReports + resolvedUserReports;

    // Shout Categories
    const categories = await this.prisma.shout.findMany({
      distinct: ['category'],
      select: { category: true },
      where: { category: { not: null }, deleted_at: null },
    });

    const shoutCategories = await Promise.all(
      categories.map(async (cat) => {
        const voice = await this.prisma.shout.count({
          where: {
            category: cat.category,
            deleted_at: null,
            medias: { some: { type: 'AUDIO' } },
          },
        });
        const total = await this.prisma.shout.count({
          where: { category: cat.category, deleted_at: null },
        });
        return {
          category: cat.category,
          textPosts: total - voice,
          voicePosts: voice,
        };
      }),
    );

    // Graph Data
    const graphData = await this.getGraphData(period);

    return {
      totalUsers: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
      },
      totalShouts: {
        total: totalShouts,
        text: textShouts,
        voice: voiceShouts,
      },
      totalReports: {
        total: totalReports,
        pending: pendingReports,
        resolved: resolvedReports,
      },
      shoutCategories,
      overview: graphData,
    };
  }

  private async getGraphData(period: 'year' | 'month' | 'week' | 'all') {
    const now = new Date();
    let startDate: Date;
    let dateFormat: string;

    if (period === 'year') {
      startDate = startOfYear(now);
      dateFormat = 'MMM'; // Jan, Feb
    } else if (period === 'month') {
      startDate = startOfMonth(now);
      dateFormat = 'dd'; // 01, 02
    } else if (period === 'week') {
      startDate = startOfWeek(now);
      dateFormat = 'EEE'; // Mon, Tue
    } else {
      startDate = new Date(0); // All time
      dateFormat = 'MMM yyyy'; // Jan 2024
    }

    const users = await this.prisma.user.findMany({
      where: {
        created_at: {
          gte: startDate,
        },
        deleted_at: null,
      },
      select: {
        created_at: true,
        status: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    const grouped = new Map<string, { active: number; anonymous: number }>();

    users.forEach((user) => {
      const key = format(user.created_at, dateFormat);
      const current = grouped.get(key) || { active: 0, anonymous: 0 };

      if (user.status === UserStatus.ACTIVE) {
        current.active++;
      } else {
        current.anonymous++;
      }
      grouped.set(key, current);
    });

    return Array.from(grouped.entries()).map(([label, data]) => ({
      label,
      active: data.active,
      anonymous: data.anonymous,
    }));
  }
}
