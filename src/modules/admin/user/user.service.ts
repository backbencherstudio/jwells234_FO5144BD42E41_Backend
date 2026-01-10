import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import appConfig from '../../../config/app.config';
import { SazedStorage } from '../../../common/lib/Disk/SazedStorage';
import { DateHelper } from '../../../common/helper/date.helper';

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
  }: {
    q?: string;
    type?: string;
    approved?: string;
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

      const users = await this.prisma.user.findMany({
        where: {
          ...where_condition,
        },
        orderBy: { created_at: 'desc' },
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

      return {
        success: true,
        data: users,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getUserById(id: string) {
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

      const shouts = await this.prisma.shout.findMany({
        where: {
          user_id: id,
        },
        orderBy: { created_at: 'desc' },
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
      });

      user['shouts'] = shouts;

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
