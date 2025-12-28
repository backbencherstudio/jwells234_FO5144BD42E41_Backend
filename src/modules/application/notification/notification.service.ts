import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationGateway))
    private notificationGateway: NotificationGateway,
  ) {}

  async createNotification(data: {
    sender_id?: string;
    receiver_id: string;
    type: string;
    text: string;
    entity_id?: string;
  }) {
    const event = await this.prisma.notificationEvent.create({
      data: {
        type: data.type,
        text: data.text,
      },
    });

    const notification = await this.prisma.notification.create({
      data: {
        sender_id: data.sender_id,
        receiver_id: data.receiver_id,
        notification_event_id: event.id,
        entity_id: data.entity_id,
      },
      include: {
        notification_event: true,
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    await this.notificationGateway.sendNotificationToUser(
      data.receiver_id,
      notification,
    );

    return notification;
  }

  async getAllNotifications(userId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const notifications = await this.prisma.notification.findMany({
        where: {
          receiver_id: userId,
        },
        include: {
          notification_event: true,
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      return {
        success: true,
        data: notifications,
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return {
        success: false,
        message: 'Failed to fetch notifications',
      };
    }
  }

  async markAsRead(userId: string, notificationId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const notification = await this.prisma.notification.findUnique({
        where: { id: notificationId },
      });
      if (!notification || notification.receiver_id !== userId) {
        return {
          success: false,
          message: 'Notification not found or unauthorized',
        };
      }

      await this.prisma.notification.update({
        where: {
          id: notificationId,
          receiver_id: userId,
        },
        data: {
          read_at: new Date(),
        },
      });

      return {
        success: true,
        message: 'Notification marked as read',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to mark notification as read',
      };
    }
  }

  async markAllAsRead(userId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const notification = await this.prisma.notification.findFirst({
        where: {
          receiver_id: userId,
          read_at: null,
        },
      });
      if (!notification) {
        return {
          success: true,
          message: 'No unread notifications',
        };
      }

      await this.prisma.notification.updateMany({
        where: {
          receiver_id: userId,
          read_at: null,
        },
        data: {
          read_at: new Date(),
        },
      });

      return {
        success: true,
        message: 'All notifications marked as read',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to mark all notifications as read',
      };
    }
  }

  async markAsUnread(userId: string, notificationId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const notification = await this.prisma.notification.findUnique({
        where: { id: notificationId },
      });
      if (!notification || notification.receiver_id !== userId) {
        return {
          success: false,
          message: 'Notification not found or unauthorized',
        };
      }

      await this.prisma.notification.update({
        where: {
          id: notificationId,
          receiver_id: userId,
        },
        data: {
          read_at: null,
        },
      });
      return {
        success: true,
        message: 'Notification marked as unread',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to mark notification as unread',
      };
    }
  }

  async deleteNotification(userId: string, notificationId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const notification = await this.prisma.notification.findUnique({
        where: { id: notificationId },
      });
      if (!notification || notification.receiver_id !== userId) {
        return {
          success: false,
          message: 'Notification not found or unauthorized',
        };
      }

      await this.prisma.notification.deleteMany({
        where: {
          id: notificationId,
          receiver_id: userId,
        },
      });
      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete notification',
      };
    }
  }
}
