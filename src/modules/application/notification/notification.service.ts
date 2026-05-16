import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UnregisterDeviceTokenDto } from './dto/unregister-device-token.dto';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationGateway))
    private notificationGateway: NotificationGateway,
    @InjectQueue('push-queue')
    private readonly pushQueue: Queue,
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

    await this.enqueuePushForUser(data.receiver_id, notification);

    return notification;
  }

  async registerDeviceToken(userId: string, payload: RegisterDeviceTokenDto) {
    try {
      const token = payload.token.trim();

      await this.prisma.deviceToken.upsert({
        where: { token },
        update: {
          user_id: userId,
          platform: payload.platform,
          deleted_at: null,
        },
        create: {
          user_id: userId,
          token,
          platform: payload.platform,
        },
      });

      return {
        success: true,
        statusCode: 200,
        message: 'Device token registered successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async unregisterDeviceToken(
    userId: string,
    payload: UnregisterDeviceTokenDto,
  ) {
    try {
      const token = payload.token.trim();

      await this.prisma.deviceToken.deleteMany({
        where: {
          user_id: userId,
          token,
        },
      });

      return {
        success: true,
        statusCode: 200,
        message: 'Device token unregistered successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async getAllNotifications(userId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          statusCode: 400,
          message: 'User ID is required',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          statusCode: 404,
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
        statusCode: 200,
        data: notifications,
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to fetch notifications',
      };
    }
  }

  async markAsRead(userId: string, notificationId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          statusCode: 400,
          message: 'User ID is required',
        };
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }

      const notification = await this.prisma.notification.findUnique({
        where: { id: notificationId },
      });
      if (!notification || notification.receiver_id !== userId) {
        return {
          success: false,
          statusCode: 404,
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
        statusCode: 200,
        message: 'Notification marked as read',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to mark notification as read',
      };
    }
  }

  async markAllAsRead(userId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          statusCode: 400,
          message: 'User ID is required',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return {
          success: false,
          statusCode: 404,
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
          statusCode: 200,
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
        statusCode: 200,
        message: 'All notifications marked as read',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to mark all notifications as read',
      };
    }
  }

  async markAsUnread(userId: string, notificationId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          statusCode: 400,
          message: 'User ID is required',
        };
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }

      const notification = await this.prisma.notification.findUnique({
        where: { id: notificationId },
      });
      if (!notification || notification.receiver_id !== userId) {
        return {
          success: false,
          statusCode: 404,
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
        statusCode: 200,
        message: 'Notification marked as unread',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to mark notification as unread',
      };
    }
  }

  async deleteNotification(userId: string, notificationId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          statusCode: 400,
          message: 'User ID is required',
        };
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }

      const notification = await this.prisma.notification.findUnique({
        where: { id: notificationId },
      });
      if (!notification || notification.receiver_id !== userId) {
        return {
          success: false,
          statusCode: 404,
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
        statusCode: 200,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to delete notification',
      };
    }
  }

  private async enqueuePushForUser(receiverId: string, notification: any) {
    const tokens = await this.prisma.deviceToken.findMany({
      where: {
        user_id: receiverId,
        deleted_at: null,
      },
      select: {
        token: true,
      },
    });

    if (!tokens.length) {
      return;
    }

    const title = notification?.sender?.name
      ? `${notification.sender.name}`
      : 'New notification';

    const body = notification?.notification_event?.text || 'You have an update';

    const data = this.toFcmData({
      notification_id: notification.id,
      receiver_id: receiverId,
      sender_id: notification.sender_id,
      type: notification?.notification_event?.type,
      entity_id: notification.entity_id,
    });

    await this.pushQueue.add('sendPushToUser', {
      receiver_id: receiverId,
      tokens: tokens.map((item) => item.token),
      title,
      body,
      data,
    });
  }

  private toFcmData(input: Record<string, any>) {
    const mapped: Record<string, string> = {};

    Object.entries(input || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        mapped[key] = String(value);
      }
    });

    return mapped;
  }
}
