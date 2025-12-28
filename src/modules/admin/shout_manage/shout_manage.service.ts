import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from '../../application/notification/notification.service';

import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class ShoutManageService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async getAllShouts() {
    try {
      const shouts = await this.prisma.shout.findMany({
        orderBy: {
          created_at: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              avatar: true,
            },
          },
          medias: true,
          shoutReports: true,
          _count: {
            select: {
              likes: true,
              comments: true,
              shares: true,
            },
          },
        },
      });

      // Group shouts by user
      const shoutsByUser = new Map<string, any>();

      for (const shout of shouts) {
        const userId = shout.user_id;
        if (!shoutsByUser.has(userId)) {
          shoutsByUser.set(userId, {
            user: shout.user,
            shouts: [],
            stats: {
              postsType: {
                text: 0,
                audio: 0,
              },
              userType: {
                profile: 0,
                anonymous: 0,
              },
              tags: {
                Idea: 0,
                Observation: 0,
                Thought: 0,
                Gratitude: 0,
                Concern: 0,
                Gossip: 0,
              },
              reports: 0,
            },
          });
        }

        const userEntry = shoutsByUser.get(userId);
        userEntry.shouts.push(shout);

        // Calculate Stats
        // 1. Posts Type (Text vs Audio)
        const isAudio = shout.medias.some((m) => m.type === 'AUDIO');
        if (isAudio) {
          userEntry.stats.postsType.audio++;
        } else {
          userEntry.stats.postsType.text++;
        }

        // 2. User Type (Profile vs Anonymous)
        if (shout.is_anonymous) {
          userEntry.stats.userType.anonymous++;
        } else {
          userEntry.stats.userType.profile++;
        }

        // 3. Tags (Category)
        if (
          shout.category &&
          userEntry.stats.tags[shout.category] !== undefined
        ) {
          userEntry.stats.tags[shout.category]++;
        }

        // 4. Reports
        userEntry.stats.reports += shout.shoutReports.length;
      }

      const result = Array.from(shoutsByUser.values());

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async contentManagementByUser(startDate: string, endDate: string) {
    try {
      let dateFilter = {};

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new Error('Invalid date format');
        }

        end.setHours(23, 59, 59, 999); // Include the entire end date
        dateFilter = {
          created_at: {
            gte: start,
            lte: end,
          },
        };
      }

      // Fetch shouts within date range
      const shouts = await this.prisma.shout.findMany({
        where: dateFilter,
        orderBy: {
          created_at: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              avatar: true,
            },
          },
          medias: true,
          shoutReports: true,
          _count: {
            select: {
              likes: true,
              comments: true,
              shares: true,
            },
          },
        },
      });

      // Group shouts by user
      const shoutsByUser = new Map<string, any>();

      for (const shout of shouts) {
        const userId = shout.user_id;
        if (!shoutsByUser.has(userId)) {
          shoutsByUser.set(userId, {
            user: shout.user,
            shouts: [],
            stats: {
              postsType: {
                text: 0,
                audio: 0,
              },
              userType: {
                profile: 0,
                anonymous: 0,
              },
              status: {
                published: 0,
                flagged: 0,
              },
            },
          });
        }

        const userEntry = shoutsByUser.get(userId);

        // Determine Status from DB Enum (PUBLISHED, FLAGGED, DELETED)
        const status = shout.status; // 'PUBLISHED' | 'FLAGGED' | 'DELETED'

        if (status === 'FLAGGED') {
          userEntry.stats.status.flagged++;
        } else if (status === 'PUBLISHED') {
          userEntry.stats.status.published++;
        } else {
          // Skip DELETED shouts from stats and listing
          continue;
        }

        // Determine Post Type for this specific shout
        const isAudio = shout.medias.some((m) => m.type === 'AUDIO');
        const postType = isAudio ? 'AUDIO' : 'TEXT';

        // Determine User Type for this specific shout
        const userType = shout.is_anonymous ? 'Anonymous' : 'Profile';

        // Add formatted shout object to the list
        userEntry.shouts.push({
          id: shout.id,
          content: shout.content,
          location: shout.location,
          createdAt: shout.created_at,
          type: postType,
          userType: userType,
          status: status,
          stats: {
            likes: shout._count.likes,
            comments: shout._count.comments,
            shares: shout._count.shares,
          },
          medias: shout.medias,
        });

        // Update Aggregate Stats
        if (isAudio) {
          userEntry.stats.postsType.audio++;
        } else {
          userEntry.stats.postsType.text++;
        }

        if (shout.is_anonymous) {
          userEntry.stats.userType.anonymous++;
        } else {
          userEntry.stats.userType.profile++;
        }
      }

      const result = Array.from(shoutsByUser.values());

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getShoutById(id: string) {
    try {
      if (!id) {
        throw new Error('Shout ID is required');
      }

      const shout = await this.prisma.shout.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              avatar: true,
            },
          },
          medias: true,
          shoutReports: true,
          _count: {
            select: {
              likes: true,
              comments: true,
              shares: true,
            },
          },
        },
      });

      return {
        success: true,
        data: shout,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateStatus(id: string, body: UpdateStatusDto) {
    try {
      if (!id) {
        throw new Error('Shout ID is required');
      }
      const shout = await this.prisma.shout.findUnique({
        where: { id },
      });
      if (!shout) {
        throw new Error('Shout not found');
      }

      const updatedShout = await this.prisma.shout.update({
        where: { id },
        data: { status: body.status },
      });

      // Send Notification
      await this.notificationService.createNotification({
        receiver_id: updatedShout.user_id,
        type: 'SHOUT_STATUS_UPDATE',
        text: `Your shout status has been updated to ${body.status}.`,
        entity_id: updatedShout.id,
      });

      return {
        success: true,
        data: updatedShout,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteShout(id: string) {
    try {
      if (!id) {
        throw new Error('Shout ID is required');
      }

      await this.prisma.shout.delete({
        where: { id },
      });
      return {
        success: true,
        message: 'Shout deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
