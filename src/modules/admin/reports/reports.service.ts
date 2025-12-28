import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReportQueryDto, ReportType } from './dto/report-query.dto';
import { ReportStatus, UserStatus } from '@prisma/client';
import { NotificationService } from '../../../modules/application/notification/notification.service';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async getAnalytics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      shoutPending,
      userPending,
      shoutReviewed,
      userReviewed,
      shoutResolvedToday,
      userResolvedToday,
      shoutHighSeverity,
      userHighSeverity,
    ] = await Promise.all([
      this.prisma.shoutReport.count({ where: { status: 'PENDING' } }),
      this.prisma.userReport.count({ where: { status: 'PENDING' } }),
      this.prisma.shoutReport.count({ where: { status: 'REVIEWED' } }),
      this.prisma.userReport.count({ where: { status: 'REVIEWED' } }),
      this.prisma.shoutReport.count({
        where: { status: 'RESOLVED', updated_at: { gte: today } },
      }),
      this.prisma.userReport.count({
        where: { status: 'RESOLVED', updated_at: { gte: today } },
      }),
      this.prisma.shoutReport.count({ where: { status: 'HIGH_SEVERITY' } }),
      this.prisma.userReport.count({ where: { status: 'HIGH_SEVERITY' } }),
    ]);

    return {
      pendingReports: shoutPending + userPending,
      inReview: shoutReviewed + userReviewed,
      resolvedToday: shoutResolvedToday + userResolvedToday,
      highSeverity: shoutHighSeverity + userHighSeverity,
    };
  }

  async findAll(query: ReportQueryDto) {
    const { page = 1, limit = 10, status, type } = query;
    const skip = (page - 1) * limit;
    // If combining, we need to fetch enough to sort and slice correctly
    const take = type ? limit : limit + skip;

    let shoutReports = [];
    let userReports = [];
    let totalShout = 0;
    let totalUser = 0;

    if (!type || type === ReportType.SHOUT) {
      const where: any = {};
      if (status) where.status = status;

      totalShout = await this.prisma.shoutReport.count({ where });
      shoutReports = await this.prisma.shoutReport.findMany({
        where,
        include: {
          user: true,
          shout: { include: { user: true } },
        },
        orderBy: { created_at: 'desc' },
        take: type === ReportType.SHOUT ? limit : take,
        skip: type === ReportType.SHOUT ? skip : 0,
      });
    }

    if (!type || type === ReportType.USER) {
      const where: any = {};
      if (status) where.status = status;

      totalUser = await this.prisma.userReport.count({ where });
      userReports = await this.prisma.userReport.findMany({
        where,
        include: {
          reporter: true,
          reported: true,
        },
        orderBy: { created_at: 'desc' },
        take: type === ReportType.USER ? limit : take,
        skip: type === ReportType.USER ? skip : 0,
      });
    }

    const combined = [
      ...shoutReports.map((r) => ({
        id: r.id,
        type: ReportType.SHOUT,
        date: r.created_at,
        reason: r.reason,
        status: r.status,
        reporter: {
          id: r.user.id,
          name: r.user.name,
          username: r.user.username,
          avatar: r.user.avatar,
        },
        reportedEntity: {
          id: r.shout.user.id,
          name: r.shout.user.name,
          username: r.shout.user.username,
          avatar: r.shout.user.avatar,
          content: r.shout.content,
          shoutId: r.shout.id,
        },
      })),
      ...userReports.map((r) => ({
        id: r.id,
        type: ReportType.USER,
        date: r.created_at,
        reason: r.reason,
        status: r.status,
        reporter: {
          id: r.reporter.id,
          name: r.reporter.name,
          username: r.reporter.username,
          avatar: r.reporter.avatar,
        },
        reportedEntity: {
          id: r.reported.id,
          name: r.reported.name,
          username: r.reported.username,
          avatar: r.reported.avatar,
        },
      })),
    ];

    let result = combined;
    const total = totalShout + totalUser;

    if (!type) {
      result.sort((a, b) => b.date.getTime() - a.date.getTime());
      result = result.slice(skip, skip + limit);
    }

    return {
      data: result,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateStatus(id: string, type: ReportType, status: ReportStatus) {
    if (type === ReportType.SHOUT) {
      return this.prisma.shoutReport.update({
        where: { id },
        data: { status },
      });
    } else {
      return this.prisma.userReport.update({
        where: { id },
        data: { status },
      });
    }
  }

  async findOne(id: string, type: ReportType) {
    let report;
    if (type === ReportType.SHOUT) {
      report = await this.prisma.shoutReport.findUnique({
        where: { id },
        include: {
          user: {
            include: {
              _count: { select: { shouts: true, reports_received: true } },
            },
          },
          shout: {
            include: {
              user: {
                include: {
                  _count: { select: { shouts: true, reports_received: true } },
                },
              },
            },
          },
        },
      });
    } else {
      report = await this.prisma.userReport.findUnique({
        where: { id },
        include: {
          reporter: {
            include: {
              _count: { select: { shouts: true, reports_received: true } },
            },
          },
          reported: {
            include: {
              _count: { select: { shouts: true, reports_received: true } },
            },
          },
        },
      });
    }

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async warnUser(userId: string, reasons: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Update user status to WARNING if not already banned
    if (user.status !== UserStatus.BANNED) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.WARNING },
      });
    }

    // Send notification
    const message = `You have received a warning for the following reasons: ${reasons.join(', ')}`;
    await this.notificationService.createNotification({
      receiver_id: userId,
      type: 'WARNING',
      text: message,
    });

    return { message: 'User warned successfully' };
  }

  async banUser(userId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.BANNED },
    });

    // Send notification
    const message = `Your account has been banned. Reason: ${reason || 'Violation of terms'}`;
    await this.notificationService.createNotification({
      receiver_id: userId,
      type: 'BAN',
      text: message,
    });

    return { message: 'User banned successfully' };
  }

  async sendMessage(userId: string, message: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.notificationService.createNotification({
      receiver_id: userId,
      type: 'ADMIN_MESSAGE',
      text: message,
    });

    return { message: 'Message sent successfully' };
  }

  async remove(id: string) {
    // Try deleting from shout reports
    const deletedShoutReport = await this.prisma.shoutReport.deleteMany({
      where: { id },
    });
    if (deletedShoutReport.count > 0) {
      return { message: 'Shout report deleted successfully' };
    }
    // Try deleting from user reports
    const deletedUserReport = await this.prisma.userReport.deleteMany({
      where: { id },
    });
    if (deletedUserReport.count > 0) {
      return { message: 'User report deleted successfully' };
    }

    throw new NotFoundException('Report not found');
  }
}
