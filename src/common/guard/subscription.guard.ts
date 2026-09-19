import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      return false;
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.userId,
        isActive: true,
      },
    });

    if (!subscription) {
      throw new ForbiddenException(
        'Active subscription required to access this resource',
      );
    }

    // Check if expired
    if (subscription.endDate && new Date() > subscription.endDate) {
      throw new ForbiddenException('Subscription expired');
    }

    return true;
  }
}
