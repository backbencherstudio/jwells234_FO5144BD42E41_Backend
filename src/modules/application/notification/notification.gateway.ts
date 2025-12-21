import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { NotificationService } from './notification.service';
import appConfig from '../../../config/app.config';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private redisPubClient: Redis;
  private redisSubClient: Redis;

  // Map to store connected clients (UserId -> Set of SocketIds)
  private clients = new Map<string, Set<string>>();

  constructor(private readonly notificationService: NotificationService) {}

  onModuleInit() {
    this.redisPubClient = new Redis({
      host: appConfig().redis.host,
      port: Number(appConfig().redis.port),
      password: appConfig().redis.password,
    });

    this.redisSubClient = new Redis({
      host: appConfig().redis.host,
      port: Number(appConfig().redis.port),
      password: appConfig().redis.password,
    });

    this.redisSubClient.subscribe('notification', (err, message: string) => {
      if (err) {
        console.error('Redis subscribe error:', err);
        return;
      }
      try {
        const data = JSON.parse(message);
        // Only send to the specific receiver if they are connected
        if (data.receiver_id) {
          const userSockets = this.clients.get(data.receiver_id);
          if (userSockets) {
            userSockets.forEach((socketId) => {
              this.server.to(socketId).emit('receiveNotification', data);
            });
          }
        }
      } catch (parseError) {
        console.error('Error parsing notification message:', parseError);
      }
    });
  }

  afterInit(server: Server) {
    console.log('Websocket server started');
  }

  async handleConnection(client: Socket, ...args: any[]) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId).add(client.id);
      console.log(`User ${userId} connected with socket ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, sockets] of this.clients.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.clients.delete(userId);
        }
        console.log(`User ${userId} disconnected socket ${client.id}`);
        break;
      }
    }
  }

  // @SubscribeMessage('joinRoom')
  // handleRoomJoin(client: Socket, room: string) {
  //   client.join(room);
  //   client.emit('joinedRoom', room);
  // }

  @SubscribeMessage('sendNotification')
  async handleNotification(@MessageBody() data: any) {
    console.log(`Received notification: ${JSON.stringify(data)}`);
    // Broadcast notification to all clients
    // this.server.emit('receiveNotification', data);

    // Emit notification to specific client
    const targetSocketId = this.clients.get(data.userId);
    if (targetSocketId) {
      await this.redisPubClient.publish('notification', JSON.stringify(data));

      // console.log(`Notification sent to user ${data.userId}`);
    } else {
      // console.log(`User ${data.userId} not connected`);
    }
  }
}
