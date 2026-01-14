import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import appConfig from '../../../config/app.config';
import { SazedStorage } from '../../../common/lib/Disk/SazedStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { UserStatus } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const user = await UserRepository.createUser(createUserDto);

      if (user.success) {
        return {
          success: user.success,
          message: user.message,
        };
      } else {
        return {
          success: user.success,
          message: user.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getAllUsers({
    q,
    type,
    approved,
    status,
    page = 1,
    limit = 20,
  }: {
    q?: string;
    type?: string;
    approved?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const where_condition = {};
      if (q) {
        where_condition['OR'] = [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ];
      }

      if (type) {
        where_condition['type'] = type;
      }

      if (approved) {
        where_condition['approved_at'] =
          approved == 'approved' ? { not: null } : { equals: null };
      }

      if (status) {
        const normalized = String(status).trim().toUpperCase();
        const allowed = new Set<string>(Object.values(UserStatus));
        if (!allowed.has(normalized)) {
          return {
            success: false,
            statusCode: 400,
            message: `Invalid status. Allowed: ${Object.values(UserStatus).join(', ')}`,
          };
        }
        where_condition['status'] = normalized;
      }

      const safePage = Number.isFinite(page) && page > 0 ? page : 1;
      const safeLimit = Number.isFinite(limit)
        ? Math.min(100, Math.max(1, limit))
        : 20;
      const skip = (safePage - 1) * safeLimit;

      const [total, users] = await Promise.all([
        this.prisma.user.count({
          where: {
            ...where_condition,
          },
        }),
        this.prisma.user.findMany({
          where: {
            ...where_condition,
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: safeLimit,
          select: {
            id: true,
            name: true,
            avatar: true,
            username: true,
            email: true,
            phone_number: true,
            address: true,
            type: true,
            status: true,
            approved_at: true,
            created_at: true,
            updated_at: true,
          },
        }),
      ]);

      // check user premium or free
      for (const user of users) {
        const activeSubscription = await this.prisma.subscription.findFirst({
          where: {
            userId: user.id,
            isActive: true,
            endDate: {
              gt: new Date(),
            },
          },
        });
        user['subscription_status'] = activeSubscription
          ? activeSubscription.type
          : 'free';
        // add avatar url to user
        if (user.avatar) {
          user['avatar_url'] = SazedStorage.url(
            appConfig().storageUrl.avatar + user.avatar,
          );
        }
      }

      const totalPages = Math.max(1, Math.ceil(total / safeLimit));

      return {
        success: true,
        data: users,
        meta: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages,
          hasPrev: safePage > 1,
          hasNext: safePage < totalPages,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getUserById(
    id: string,
    opts?: {
      shoutPage?: number;
      shoutLimit?: number;
    },
  ) {
    try {
      if (!id) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: {
          id: id,
        },
        select: {
          id: true,
          name: true,
          avatar: true,
          username: true,
          email: true,
          phone_number: true,
          address: true,
          type: true,
          status: true,
          approved_at: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // check user premium or free
      if (user) {
        const activeSubscription = await this.prisma.subscription.findFirst({
          where: {
            userId: user.id,
            isActive: true,
            endDate: {
              gt: new Date(),
            },
          },
        });
        user['subscription_status'] = activeSubscription
          ? activeSubscription.type
          : 'free';
      }

      // add avatar url to user
      if (user.avatar) {
        user['avatar_url'] = SazedStorage.url(
          appConfig().storageUrl.avatar + user.avatar,
        );
      }

      const shoutPage =
        opts?.shoutPage && Number.isFinite(opts.shoutPage) && opts.shoutPage > 0
          ? opts.shoutPage
          : 1;
      const shoutLimit =
        opts?.shoutLimit && Number.isFinite(opts.shoutLimit)
          ? Math.min(50, Math.max(1, opts.shoutLimit))
          : 10;
      const shoutSkip = (shoutPage - 1) * shoutLimit;

      const shoutWhere = {
        user_id: id,
      };

      const [shoutsTotal, shouts] = await Promise.all([
        this.prisma.shout.count({
          where: shoutWhere,
        }),
        this.prisma.shout.findMany({
          where: shoutWhere,
          orderBy: { created_at: 'desc' },
          skip: shoutSkip,
          take: shoutLimit,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
            medias: true,
            _count: {
              select: {
                likes: true,
                comments: true,
                shares: true,
              },
            },
            likes: {
              where: { user_id: id },
              select: { id: true },
            },
          },
        }),
      ]);

      const shoutsTotalPages = Math.max(1, Math.ceil(shoutsTotal / shoutLimit));

      user['shouts'] = shouts;
      user['shouts_meta'] = {
        page: shoutPage,
        limit: shoutLimit,
        total: shoutsTotal,
        totalPages: shoutsTotalPages,
        hasPrev: shoutPage > 1,
        hasNext: shoutPage < shoutsTotalPages,
      };

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async warnUser(id: string) {
    try {
      if (!id) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }
      const user = await this.prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      await this.prisma.user.update({
        where: { id: id },
        data: { status: 'WARNING' },
      });
      return {
        success: true,
        message: 'User warned successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async banUser(id: string) {
    try {
      if (!id) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      await this.prisma.user.update({
        where: { id: id },
        data: { status: 'BANNED' },
      });
      return {
        success: true,
        message: 'User banned successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // async approve(id: string) {
  //   try {
  //     const user = await this.prisma.user.findUnique({
  //       where: { id: id },
  //     });
  //     if (!user) {
  //       return {
  //         success: false,
  //         message: 'User not found',
  //       };
  //     }
  //     await this.prisma.user.update({
  //       where: { id: id },
  //       data: { approved_at: DateHelper.now() },
  //     });
  //     return {
  //       success: true,
  //       message: 'User approved successfully',
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  // async reject(id: string) {
  //   try {
  //     const user = await this.prisma.user.findUnique({
  //       where: { id: id },
  //     });
  //     if (!user) {
  //       return {
  //         success: false,
  //         message: 'User not found',
  //       };
  //     }
  //     await this.prisma.user.update({
  //       where: { id: id },
  //       data: { approved_at: null },
  //     });
  //     return {
  //       success: true,
  //       message: 'User rejected successfully',
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    try {
      const user = await UserRepository.updateUser(id, updateUserDto);

      if (user.success) {
        return {
          success: user.success,
          message: user.message,
        };
      } else {
        return {
          success: user.success,
          message: user.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteUser(id: string) {
    try {
      if (!id) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const user = await UserRepository.deleteUser(id);
      return {
        success: user.success,
        message: user.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getProfile(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          avatar: true,
          username: true,
          email: true,
          phone_number: true,
          address: true,
          type: true,
          status: true,
          email_verified_at: true,
          about: true,
          date_of_birth: true,
          gender: true,
          approved_at: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // add avatar url to user
      if (user.avatar) {
        user['avatar_url'] = SazedStorage.url(
          appConfig().storageUrl.avatar + user.avatar,
        );
      }

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
