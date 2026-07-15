// external imports
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from '@nestjs-modules/ioredis';

// internal imports
import appConfig from './config/app.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ThrottlerBehindProxyGuard } from './common/guard/throttler-behind-proxy.guard';
// import { LocationGuard } from './common/guard/location.guard';
import { AbilityModule } from './ability/ability.module';
import { MailModule } from './mail/mail.module';
import { ApplicationModule } from './modules/application/application.module';
import { AdminModule } from './modules/admin/admin.module';
import { ChatModule } from './modules/chat/chat.module';
import { PaymentModule } from './modules/payment/payment.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { ShoutModule } from './modules/shout/shout.module';
import { MapExploreModule } from './modules/map-explore/map-explore.module';
import { NotificationModule } from './modules/application/notification/notification.module';
import { RevenueCatModule } from './modules/revenuecat/revenuecat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    BullModule.forRoot({
      connection: {
        host: appConfig().redis.host,
        password: appConfig().redis.password,
        port: +appConfig().redis.port,
      },
      // redis: {
      //   host: appConfig().redis.host,
      //   password: appConfig().redis.password,
      //   port: +appConfig().redis.port,
      // },
    }),
    RedisModule.forRoot({
      type: 'single',
      options: {
        host: appConfig().redis.host,
        password: appConfig().redis.password,
        port: +appConfig().redis.port,
      },
    }),

    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: parseInt(process.env.THROTTLE_SHORT_LIMIT || '15', 10),
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: parseInt(process.env.THROTTLE_MEDIUM_LIMIT || '100', 10),
      },
      {
        name: 'long',
        ttl: 60000,
        limit: parseInt(process.env.THROTTLE_LONG_LIMIT || '300', 10),
      },
    ]),
    // General modules
    PrismaModule,
    AuthModule,
    AbilityModule,
    MailModule,
    ApplicationModule,
    AdminModule,
    ChatModule,
    PaymentModule,
    SubscriptionModule,
    ShoutModule,
    MapExploreModule,
    NotificationModule,
    RevenueCatModule,
  ],
  controllers: [AppController],
  providers: [
    // {
    //   provide: APP_GUARD,
    //   useClass: LocationGuard,
    // },
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    AppService,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
