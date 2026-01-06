import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import appConfig from '../../../config/app.config';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // ignoreExpiration: false,
      ignoreExpiration: true,
      secretOrKey: appConfig().jwt.secret,
    });
  }

  async validate(payload: any) {
    const sub = payload?.sub;
    const email = payload?.email;

    const user =
      (sub
        ? await this.prisma.user.findUnique({
            where: { id: sub },
            select: { id: true, email: true },
          })
        : null) ||
      (email
        ? await this.prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true },
          })
        : null);

    if (!user) {
      throw new UnauthorizedException('Invalid token user. Please login again.');
    }

    return { userId: user.id, email: user.email };
  }
}
