import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReportQueryDto, ReportType } from './dto/report-query.dto';
import { ReportStatus, UserStatus } from '@prisma/client';
import { NotificationService } from '../../../modules/application/notification/notification.service';
import { WarnUserDto } from './dto/warn-user.dto';
import { BanUserDto } from './dto/ban-user.dto';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async getAnalytics() {
    try {
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
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to fetch analytics: ${error.message}`,
      );
    }
  }

  async findAll(query: ReportQueryDto) {
    try {
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
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to fetch reports: ${error.message}`,
      );
    }
  }

  async updateStatus(id: string, type: ReportType, status: ReportStatus) {
    try {
      if (!id || !type || !status) {
        throw new BadRequestException(
          'Invalid parameters: id, type, and status are required',
        );
      }

      if (type === ReportType.SHOUT) {
        return await this.prisma.shoutReport.update({
          where: { id },
          data: { status },
        });
      } else {
        return await this.prisma.userReport.update({
          where: { id },
          data: { status },
        });
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Report not found');
      }
      throw new InternalServerErrorException(
        `Failed to update report status: ${error.message}`,
      );
    }
  }

  async findOne(id: string, type: ReportType) {
    try {
      if (type === ReportType.SHOUT) {
        const report = await this.prisma.shoutReport.findUnique({
          where: { id },
          select: {
            id: true,
            created_at: true,
            updated_at: true,
            status: true,
            reason: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                username: true,
                avatar: true,
                type: true,
                status: true,
                created_at: true,
                updated_at: true,
                _count: {
                  select: { shouts: true, reports_received: true },
                },
              },
            },
            shout: {
              select: {
                id: true,
                content: true,
                created_at: true,
                location: true,
                category: true,
                updated_at: true,
                medias: {
                  select: {
                    id: true,
                    type: true,
                    url: true,
                    duration: true,
                  },
                },
                user: {
                  select: {
                    id: true,
                    name: true,
                    username: true,
                    email: true,
                    avatar: true,
                    status: true,
                    type: true,
                    created_at: true,
                    updated_at: true,
                    _count: {
                      select: { shouts: true, reports_received: true },
                    },
                  },
                },
              },
            },
          },
        });

        if (!report) {
          throw new NotFoundException('Report not found');
        }

        return {
          id: report.id,
          type: ReportType.SHOUT,
          created_at: report.created_at,
          updated_at: report.updated_at,
          status: report.status,
          reason: report.reason,
          reporter: {
            id: report.user.id,
            name: report.user.name,
            username: report.user.username,
            avatar: report.user.avatar,
            email: report.user.email,
            type: report.user.type,
            status: report.user.status,
            created_at: report.user.created_at,
            updated_at: report.user.updated_at,
            stats: {
              shouts: report.user._count.shouts,
              reports_received: report.user._count.reports_received,
            },
          },
          reported: {
            id: report.shout.user.id,
            name: report.shout.user.name,
            username: report.shout.user.username,
            avatar: report.shout.user.avatar,
            email: report.shout.user.email,
            type: report.shout.user.type,
            status: report.shout.user.status,
            created_at: report.shout.user.created_at,
            updated_at: report.shout.user.updated_at,
            stats: {
              shouts: report.shout.user._count.shouts,
              reports_received: report.shout.user._count.reports_received,
            },
          },
          shout: {
            id: report.shout.id,
            content: report.shout.content,
            created_at: report.shout.created_at,
            medias: report.shout.medias,
            location: report.shout.location,
            category: report.shout.category,
            updated_at: report.shout.updated_at,
          },
        };
      }

      const report = await this.prisma.userReport.findUnique({
        where: { id },
        select: {
          id: true,
          created_at: true,
          updated_at: true,
          status: true,
          reason: true,
          reporter: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              email: true,
              status: true,
              type: true,
              created_at: true,
              updated_at: true,
              _count: { select: { shouts: true, reports_received: true } },
            },
          },
          reported: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              email: true,
              status: true,
              type: true,
              created_at: true,
              updated_at: true,
              _count: { select: { shouts: true, reports_received: true } },
            },
          },
        },
      });

      if (!report) {
        throw new NotFoundException('Report not found');
      }

      return {
        id: report.id,
        type: ReportType.USER,
        created_at: report.created_at,
        updated_at: report.updated_at,
        status: report.status,
        reason: report.reason,
        reporter: {
          id: report.reporter.id,
          name: report.reporter.name,
          username: report.reporter.username,
          avatar: report.reporter.avatar,
          email: report.reporter.email,
          status: report.reporter.status,
          type: report.reporter.type,
          created_at: report.reporter.created_at,
          updated_at: report.reporter.updated_at,
          stats: {
            shouts: report.reporter._count.shouts,
            reports_received: report.reporter._count.reports_received,
          },
        },
        reported: {
          id: report.reported.id,
          name: report.reported.name,
          username: report.reported.username,
          avatar: report.reported.avatar,
          email: report.reported.email,
          status: report.reported.status,
          type: report.reported.type,
          created_at: report.reported.created_at,
          updated_at: report.reported.updated_at,
          stats: {
            shouts: report.reported._count.shouts,
            reports_received: report.reported._count.reports_received,
          },
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to fetch report details: ${error.message}`,
      );
    }
  }

  async warnUser(dto: WarnUserDto) {
    const {
      reporterId: reporterIdOverride,
      reportedId: reportedIdOverride,
      message: customMessage,
      reasons,
      reportId,
      type,
      status,
    } = dto;

    try {
      if (!reasons || reasons.length === 0) {
        throw new BadRequestException('Reasons are required');
      }

      // Resolve reporter/reported ids
      let reporterId: string | undefined = reporterIdOverride;
      let reportedId: string | undefined = reportedIdOverride;
      let currentReportStatus: ReportStatus | undefined;

      if (reportId) {
        if (!type) {
          throw new BadRequestException(
            'Report type is required when reportId is provided',
          );
        }

        if (type === ReportType.SHOUT) {
          const report = await this.prisma.shoutReport.findUnique({
            where: { id: reportId },
            select: {
              status: true,
              user_id: true,
              shout: { select: { user_id: true } }, // reported shout owner
            },
          });
          if (!report) throw new NotFoundException('Report not found');

          currentReportStatus = report.status;
          reporterId = reporterId ?? report.user_id;
          reportedId = reportedId ?? report.shout.user_id;
        } else {
          const report = await this.prisma.userReport.findUnique({
            where: { id: reportId },
            select: {
              status: true,
              reporter_id: true,
              reported_id: true,
            },
          });
          if (!report) throw new NotFoundException('Report not found');

          currentReportStatus = report.status;
          reporterId = reporterId ?? report.reporter_id;
          reportedId = reportedId ?? report.reported_id;
        }
      }

      if (!reportedId) {
        throw new BadRequestException(
          'reportedId is required (or provide reportId + type so it can be inferred)',
        );
      }

      if (reporterId && reporterId === reportedId) {
        throw new BadRequestException('You cannot warn yourself');
      }

      if (reporterId) {
        const reporter = await this.prisma.user.findUnique({
          where: { id: reporterId },
          select: { id: true },
        });
        if (!reporter) {
          throw new NotFoundException('Reporter user not found');
        }
      }

      const user = await this.prisma.user.findUnique({
        where: { id: reportedId },
        select: { status: true },
      });
      if (!user) throw new NotFoundException('User not found');

      if (user.status == UserStatus.WARNING) {
        throw new BadRequestException('User is already warned');
      }

      if (user.status === UserStatus.BANNED) {
        throw new BadRequestException('Cannot warn a banned user');
      }

      // Update user status
      await this.prisma.user.update({
        where: { id: reportedId },
        data: { status: UserStatus.WARNING },
      });

      // Update report status if needed
      if (
        reportId &&
        type &&
        status &&
        currentReportStatus &&
        currentReportStatus !== status
      ) {
        if (type === ReportType.SHOUT) {
          await this.prisma.shoutReport.update({
            where: { id: reportId },
            data: { status },
          });
        } else {
          await this.prisma.userReport.update({
            where: { id: reportId },
            data: { status },
          });
        }
      }

      // Send notification
      const message = customMessage?.trim()
        ? customMessage.trim()
        : `You have received a warning for the following reasons: ${reasons.join(', ')}`;
      await this.notificationService.createNotification({
        receiver_id: reportedId,
        type: 'WARNING',
        text: message,
      });

      const reporterNotificationMessage = `We have reviewed your report and taken appropriate action. Thank you for keeping the community safe.`;
      if (reporterId) {
        await this.notificationService.createNotification({
          receiver_id: reporterId,
          type: 'USER_WARNED',
          text: reporterNotificationMessage,
        });
      }

      return {
        success: true,
        statusCode: 200,
        message: 'User warned successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to warn user: ${error.message}`,
      );
    }
  }

  async removeWarning(userId: string) {
    try {
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });

      if (!user) throw new NotFoundException('User not found');

      if (user.status !== UserStatus.WARNING) {
        throw new BadRequestException('User is not warned');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.ACTIVE },
      });

      // Send notification
      const message = `Your warning has been removed. Please adhere to community guidelines to avoid future warnings.`;
      await this.notificationService.createNotification({
        receiver_id: userId,
        type: 'WARNING_REMOVED',
        text: message,
      });

      return { message: 'Warning removed successfully' };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to remove warning: ${error.message}`,
      );
    }
  }

  async banUser(dto: BanUserDto) {
    const {
      reporterId: reporterIdOverride,
      reportedId: reportedIdOverride,
      message: customMessage,
      reason,
      reportId,
      type,
      status,
    } = dto;

    try {
      // Resolve reporter/reported ids (prefer explicit values; otherwise infer from report)
      let reporterId: string | undefined = reporterIdOverride;
      let reportedId: string | undefined = reportedIdOverride;
      let currentReportStatus: ReportStatus | undefined;

      let shoutToBanId: string | null = null;

      if (reportId) {
        if (!type) {
          throw new BadRequestException(
            'Report Type is required when Report ID is provided',
          );
        }

        if (type === ReportType.SHOUT) {
          const report = await this.prisma.shoutReport.findUnique({
            where: { id: reportId },
            select: {
              status: true,
              shout_id: true,
              user_id: true,
              shout: { select: { user_id: true } },
            },
          });
          if (!report) throw new NotFoundException('Report not found');

          currentReportStatus = report.status;
          shoutToBanId = report.shout_id;
          reporterId = reporterId ?? report.user_id;
          reportedId = reportedId ?? report.shout.user_id;
        } else {
          const report = await this.prisma.userReport.findUnique({
            where: { id: reportId },
            select: {
              status: true,
              reporter_id: true,
              reported_id: true,
            },
          });
          if (!report) throw new NotFoundException('Report not found');

          currentReportStatus = report.status;
          reporterId = reporterId ?? report.reporter_id;
          reportedId = reportedId ?? report.reported_id;
        }
      }

      if (!reportedId) {
        throw new BadRequestException(
          'reportedId is required (or provide reportId + type so it can be inferred)',
        );
      }

      if (reporterId && reporterId === reportedId) {
        throw new BadRequestException('You cannot ban yourself');
      }

      if (reporterId) {
        const reporter = await this.prisma.user.findUnique({
          where: { id: reporterId },
        });
        if (!reporter) {
          throw new NotFoundException('Reporter user not found');
        }
      }

      const user = await this.prisma.user.findUnique({
        where: {
          id: reportedId,
        },
        select: { status: true },
      });
      if (!user) throw new NotFoundException('User not found');

      if (user.status === UserStatus.BANNED) {
        throw new BadRequestException('User is already banned');
      }

      await this.prisma.user.update({
        where: { id: reportedId },
        data: { status: UserStatus.BANNED },
      });

      // If it's a Shout Report, take down the shout content
      if (shoutToBanId) {
        await this.prisma.shout.update({
          where: { id: shoutToBanId },
          data: { deleted_at: new Date(), status: 'REMOVED' },
        });
      }

      // Update report status if needed
      if (
        reportId &&
        type &&
        status &&
        currentReportStatus &&
        currentReportStatus !== status
      ) {
        if (type === ReportType.SHOUT) {
          await this.prisma.shoutReport.update({
            where: { id: reportId },
            data: { status },
          });
        } else {
          await this.prisma.userReport.update({
            where: { id: reportId },
            data: { status },
          });
        }
      }

      // Send notification
      const message = customMessage?.trim()
        ? customMessage.trim()
        : `Your account has been banned. Reason: ${reason || 'Violation of terms'}`;
      await this.notificationService.createNotification({
        receiver_id: reportedId,
        type: 'BAN',
        text: message,
      });

      const reporterNotificationMessage = `We have reviewed your report and taken appropriate action. Thank you for keeping the community safe.`;
      if (reporterId) {
        await this.notificationService.createNotification({
          receiver_id: reporterId,
          type: 'USER_BANNED',
          text: reporterNotificationMessage,
        });
      }

      return {
        success: true,
        statusCode: 200,
        message: 'User banned successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to ban user: ${error.message}`,
      );
    }
  }

  async unbanUser(userId: string) {
    try {
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });
      if (!user) throw new NotFoundException('User not found');

      if (user.status !== UserStatus.BANNED) {
        throw new BadRequestException('User is not banned');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.ACTIVE },
      });

      // Send notification
      const message = `Your account has been unbanned. You can now access all features.`;
      await this.notificationService.createNotification({
        receiver_id: userId,
        type: 'UNBAN',
        text: message,
      });

      return { message: 'User unbanned successfully' };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to unban user: ${error.message}`,
      );
    }
  }

  async sendMessage(userId: string, message: string) {
    try {
      if (!userId || !message) {
        throw new BadRequestException('User ID and message are required');
      }
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      await this.notificationService.createNotification({
        receiver_id: userId,
        type: 'ADMIN_MESSAGE',
        text: message,
      });

      return { message: 'Message sent successfully' };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to send message: ${error.message}`,
      );
    }
  }

  async remove(id: string) {
    try {
      if (!id) {
        throw new BadRequestException('Report ID is required');
      }

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
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to delete report: ${error.message}`,
      );
    }
  }
}
