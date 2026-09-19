import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import appConfig from '../../../config/app.config';

const prisma = new PrismaClient();

// Initialize Redis client for publishing notifications
const redis = new Redis({
  host: appConfig().redis.host,
  port: Number(appConfig().redis.port),
  password: appConfig().redis.password,
});

// Initialize BullMQ Queue for push notifications
const pushQueue = new Queue('push-queue', {
  connection: {
    host: appConfig().redis.host,
    port: Number(appConfig().redis.port),
    password: appConfig().redis.password,
  },
});

export class NotificationRepository {
  /**
   * Create a notification and trigger push notification
   * @param sender_id - The ID of the user who fired the event
   * @param receiver_id - The ID of the user to notify
   * @param text - The text of the notification
   * @param message - Alternate key for text of the notification
   * @param type - The type of the notification
   * @param entity_id - The ID of the entity related to the notification
   * @returns The created notification
   */
  static async createNotification({
    sender_id,
    receiver_id,
    text,
    message,
    type,
    entity_id,
  }: {
    sender_id?: string;
    receiver_id?: string;
    text?: string;
    message?: string;
    type?: string;
    entity_id?: string;
  }) {
    const notificationText = text || message;
    const notificationEventData = {};
    if (type) {
      notificationEventData['type'] = type;
    }
    if (notificationText) {
      notificationEventData['text'] = notificationText;
    }
    const notificationEvent = await prisma.notificationEvent.create({
      data: {
        type: type,
        text: notificationText,
        ...notificationEventData,
      },
    });

    const notificationData = {};
    if (sender_id) {
      notificationData['sender_id'] = sender_id;
    }
    if (receiver_id) {
      notificationData['receiver_id'] = receiver_id;
    }
    if (entity_id) {
      notificationData['entity_id'] = entity_id;
    }

    const notification = await prisma.notification.create({
      data: {
        notification_event_id: notificationEvent.id,
        ...notificationData,
      },
    });

    // Fetch full details to send via Redis/Websocket
    try {
      const fullNotification = await prisma.notification.findUnique({
        where: { id: notification.id },
        include: {
          notification_event: true,
          sender: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
        },
      });

      if (fullNotification) {
        await redis.publish('notification', JSON.stringify(fullNotification));
      }
    } catch (error) {
      console.error('Error publishing notification to Redis:', error);
    }

    // Enqueue Firebase Push Notification
    try {
      if (receiver_id) {
        const tokens = await prisma.deviceToken.findMany({
          where: {
            user_id: receiver_id,
            deleted_at: null,
          },
          select: {
            token: true,
          },
        });

        if (tokens.length > 0) {
          const sender = sender_id ? await prisma.user.findUnique({
            where: { id: sender_id },
            select: { name: true },
          }) : null;

          const title = sender?.name ? `${sender.name}` : 'New notification';
          const body = notificationText || 'You have an update';

          const fcmData: Record<string, string> = {};
          const rawData = {
            notification_id: notification.id,
            receiver_id: receiver_id,
            sender_id: sender_id || '',
            type: type || '',
            entity_id: entity_id || '',
          };

          Object.entries(rawData).forEach(([key, val]) => {
            if (val !== undefined && val !== null) {
              fcmData[key] = String(val);
            }
          });

          await pushQueue.add('sendPushToUser', {
            receiver_id: receiver_id,
            tokens: tokens.map((item) => item.token),
            title,
            body,
            data: fcmData,
          });
        }
      }
    } catch (pushError) {
      console.error('Error queuing push notification in NotificationRepository:', pushError);
    }

    return notification;
  }
}
