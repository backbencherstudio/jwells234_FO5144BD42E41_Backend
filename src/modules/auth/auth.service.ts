// external imports
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

//internal imports
import appConfig from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../../common/repository/user/user.repository';
import { MailService } from '../../mail/mail.service';
import { UcodeRepository } from '../../common/repository/ucode/ucode.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { SazedStorage } from '../../common/lib/Disk/SazedStorage';
import { DateHelper } from '../../common/helper/date.helper';
// import { StripePayment } from '../../common/lib/Payment/stripe/StripePayment';
import { PaystackPayment } from '../../common/lib/Payment/paystack/PaystackPayment';
import { StringHelper } from '../../common/helper/string.helper';
import { CreateUserDto } from './dto/create-user.dto';
import { LocationService } from '../../common/lib/LocationService';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async register({
    name,
    email,
    username,
    password,
    type,
    avatar,
    latitude,
    longitude,
  }: {
    name: string;
    email: string;
    username: string;
    password: string;
    type?: string;
    avatar?: Express.Multer.File;
    latitude: number;
    longitude: number;
  }) {
    try {
      // Check location
      // const isAllowed = await LocationService.isLocationAllowed(
      //   latitude,
      //   longitude,
      // );
      // if (!isAllowed) {
      //   throw new ForbiddenException(
      //     'Access restricted to Bangladesh, Nigeria and USA only.',
      //   );
      // }

      // Check if email already exist
      const userEmailExist = await UserRepository.exist({
        field: 'email',
        value: String(email),
      });

      if (userEmailExist) {
        return {
          success: false,
          statusCode: 409,
          message: 'Email already exist',
        };
      }

      let mediaUrl: string | undefined = undefined;

      if (avatar?.buffer) {
        try {
          const safeName = avatar.originalname
            .toLowerCase()
            .replace(/[^a-z0-9.\s-_]/g, '') // keep only valid chars
            .replace(/\s+/g, '-') // spaces → -
            .replace(/-+/g, '-'); // remove double dashes

          const fileName = `${StringHelper.randomString()}-${safeName}`;

          await SazedStorage.put(
            `${appConfig().storageUrl.avatar}/${fileName}`,
            avatar.buffer,
          );

          mediaUrl = SazedStorage.url(
            encodeURI(`${appConfig().storageUrl.avatar}/${fileName}`),
          );
        } catch (error) {
          console.error('Failed to upload avatar:', error);
          throw new Error(`Failed to upload avatar: ${error.message}`);
        }
      }

      const user = await UserRepository.createUser({
        name: name,
        email: email,
        username: username,
        password: password,
        type: type,
        avatar: mediaUrl,
        latitude: latitude,
        longitude: longitude,
        country: 'Bangladesh',
      });

      if (!user || !user.success) {
        return {
          success: false,
          statusCode: 400,
          message: user?.message || 'Failed to create account',
        };
      }

      // create paystack customer account
      const paystackCustomer = await PaystackPayment.createCustomer({
        email: email,
        first_name: name.split(' ')[0] || name,
        last_name: name.split(' ')[1] || '',
      });

      if (paystackCustomer) {
        await this.prisma.user.update({
          where: {
            id: user.data.id,
          },
          data: {
            billing_id: paystackCustomer.customer_code,
          },
        });
      }

      // ----------------------------------------------------
      // create otp code
      const token = await UcodeRepository.createToken({
        userId: user.data.id,
        isOtp: true,
      });

      // send otp code to email
      await this.mailService.sendOtpCodeToEmail({
        email: email,
        name: name,
        otp: token,
      });

      return {
        success: true,
        statusCode: 201,
        message: 'We have sent an OTP code to your email',
        // OTP: token, // remove this line in production
      };

      // ----------------------------------------------------

      // // Generate verification token
      // const token = await UcodeRepository.createVerificationToken({
      //   userId: user.data.id,
      //   email: email,
      // });

      // // Send verification email with token
      // await this.mailService.sendVerificationLink({
      //   email,
      //   name: email,
      //   token: token.token,
      //   type: type,
      // });

      return {
        success: true,
        statusCode: 201,
        message: 'Account created successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  //   {
  //   "name": "Sazedul Islam",
  //   "first_name": "Sazedul",
  //   "last_name": "Islam",
  //   "email": "sazedulislam9126@gmail.com",
  //   "password": "123456789",
  //   "type": "user"
  // }

  async me(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          status: true,
          avatar: true,
          about: true,
          address: true,
          phone_number: true,
          type: true,
          gender: true,
          date_of_birth: true,
          created_at: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
          statusCode: 404,
        };
      }

      // Include current active subscription + minimal plan details
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          userId: userId,
          // OR: [
          //   { isActive: true },
          //   {
          //     status: {
          //       equals: 'active',
          //       mode: 'insensitive',
          //     },
          //   },
          // ],
        },
        select: {
          id: true,
          status: true,
          isActive: true,
          type: true,
          plan: {
            select: {
              id: true,
              name: true,
              type: true,
              price: true,
              currency: true,
              interval: true,
              intervalCount: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        success: true,
        statusCode: 200,
        data: {
          ...user,
          subscription: subscription || null,
        },
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async updateUser(
    userId: string,
    updateUserDto: UpdateUserDto,
    avatar?: Express.Multer.File,
  ) {
    try {
      const data: any = {};
      if (updateUserDto.name) {
        data.name = updateUserDto.name;
      }

      if (updateUserDto.username) {
        data.username = updateUserDto.username;
      }

      if (updateUserDto.about) {
        data.about = updateUserDto.about;
      }

      if (updateUserDto.phone_number) {
        data.phone_number = updateUserDto.phone_number;
      }
      if (updateUserDto.country) {
        data.country = updateUserDto.country;
      }
      if (updateUserDto.state) {
        data.state = updateUserDto.state;
      }
      if (updateUserDto.local_government) {
        data.local_government = updateUserDto.local_government;
      }
      if (updateUserDto.city) {
        data.city = updateUserDto.city;
      }
      if (updateUserDto.zip_code) {
        data.zip_code = updateUserDto.zip_code;
      }
      if (updateUserDto.address) {
        data.address = updateUserDto.address;
      }
      if (updateUserDto.gender) {
        data.gender = updateUserDto.gender;
      }
      if (updateUserDto.date_of_birth) {
        data.date_of_birth = DateHelper.format(updateUserDto.date_of_birth);
      }

      if (updateUserDto.latitude && updateUserDto.longitude) {
        data.latitude = updateUserDto.latitude;
        data.longitude = updateUserDto.longitude;
        data.country = 'Bangladesh';
      }

      let mediaUrl: string | undefined;

      if (avatar?.buffer) {
        try {
          // 1. Upload new avatar
          const safeName = avatar.originalname
            .toLowerCase()
            .replace(/[^a-z0-9.\s-_]/g, '') // keep only valid chars
            .replace(/\s+/g, '-') // spaces → -
            .replace(/-+/g, '-'); // remove double dashes

          const fileName = `${StringHelper.randomString()}-${safeName}`;
          const key = `${appConfig().storageUrl.avatar}/${fileName}`;

          await SazedStorage.put(key, avatar.buffer);
          mediaUrl = SazedStorage.url(encodeURI(key));

          // 2. Get old avatar (if any)
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { avatar: true },
          });

          // 3. Delete old avatar if exists and is not empty
          if (user?.avatar) {
            try {
              // If avatar stored is a full URL -> extract its path
              const url = new URL(user.avatar);
              const oldKey = url.pathname.replace(/^\/+/, ''); // remove leading slash

              await SazedStorage.delete(oldKey);
            } catch {
              // If it wasn't a URL, assume it is the actual storage key
              await SazedStorage.delete(user.avatar);
            }
          }

          // 4. Update user's avatar
          data.avatar = mediaUrl;
        } catch (err: any) {
          console.warn('Avatar upload failed:', err.message || err);
        }
      }

      const user = await UserRepository.getUserDetails(userId);
      if (!user) {
        return { success: false, statusCode: 404, message: 'User not found' };
      }

      if (user) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            ...data,
          },
        });

        return {
          success: true,
          statusCode: 200,
          message: 'User updated successfully',
        };
      } else {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async validateUser(
    email: string,
    pass: string,
    token?: string,
  ): Promise<any> {
    const _password = pass;
    const user = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    if (user) {
      const _isValidPassword = await UserRepository.validatePassword({
        email: email,
        password: _password,
      });
      if (_isValidPassword) {
        const { password, ...result } = user;
        if (user.is_two_factor_enabled) {
          if (token) {
            const isValid = await UserRepository.verify2FA(user.id, token);
            if (!isValid) {
              throw new UnauthorizedException('Invalid token');
              // return {
              //   success: false,
              //   message: 'Invalid token',
              // };
            }
          } else {
            throw new UnauthorizedException('Token is required');
            // return {
            //   success: false,
            //   message: 'Token is required',
            // };
          }
        }
        return result;
      } else {
        throw new UnauthorizedException('Password not matched');
        // return {
        //   success: false,
        //   message: 'Password not matched',
        // };
      }
    } else {
      throw new UnauthorizedException('Email not found');
      // return {
      //   success: false,
      //   message: 'Email not found',
      // };
    }
  }

  async login({ email, userId, latitude, longitude }) {
    try {
      const user = await UserRepository.getUserDetails(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const isAdminUser =
        !!user.type && user.type.toLowerCase().includes('admin');

      // Check location for regular users only
      if (!isAdminUser) {
        if (latitude === undefined || longitude === undefined) {
          throw new ForbiddenException('Location coordinates are required.');
        }

        // const isAllowed = await LocationService.isLocationAllowed(
        //   latitude,
        //   longitude,
        // );

        // if (!isAllowed) {
        //   throw new ForbiddenException(
        //     'Access restricted to Bangladesh, Nigeria and USA only.',
        //   );
        // }
      }

      const payload = { email: email, sub: userId };

      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

      // store refreshToken
      await this.redis.set(
        `refresh_token:${user.id}`,
        refreshToken,
        'EX',
        60 * 60 * 24 * 7, // 7 days in seconds
      );

      return {
        success: true,
        statusCode: 200,
        message: 'Logged in successfully',
        authorization: {
          type: 'bearer',
          access_token: accessToken,
          refresh_token: refreshToken,
        },
        type: user.type,
      };
    } catch (error) {
      throw error;
    }
  }

  // google log in using passport.js
  async googleLogin({ email, userId }: { email: string; userId: string }) {
    try {
      const payload = { email: email, sub: userId };

      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

      const user = await UserRepository.getUserDetails(userId);

      await this.redis.set(
        `refresh_token:${user.id}`,
        refreshToken,
        'EX',
        60 * 60 * 24 * 7,
      );

      // create paystack customer account id
      try {
        const paystackCustomer = await PaystackPayment.createCustomer({
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
        });

        if (paystackCustomer) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { billing_id: paystackCustomer.customer_code },
          });
        }
      } catch (error) {
        return {
          success: false,
          statusCode: 400,
          message: 'User created but failed to create billing account',
        };
      }

      return {
        message: 'Logged in successfully',
        statusCode: 200,
        authorization: {
          type: 'bearer',
          access_token: accessToken,
          refresh_token: refreshToken,
        },
        type: user.type,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async refreshToken(
    user_id: string,
    refreshToken: string,
    latitude?: number,
    longitude?: number,
  ) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);

      if (!storedToken || storedToken != refreshToken) {
        return {
          success: false,
          statusCode: 401,
          message: 'Refresh token is required',
        };
      }

      if (!user_id) {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }

      const userDetails = await UserRepository.getUserDetails(user_id);
      if (!userDetails) {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }

      const isAdminUser =
        !!userDetails.type && userDetails.type.toLowerCase().includes('admin');

      // Check location for regular users only (Mobile App Re-open Scenario)
      if (!isAdminUser) {
        if (latitude === undefined || longitude === undefined) {
          return {
            success: false,
            statusCode: 403,
            message: 'Location coordinates are required.',
          };
        }

        // const isAllowed = await LocationService.isLocationAllowed(
        //   latitude,
        //   longitude,
        // );

        // if (!isAllowed) {
        //   return {
        //     success: false,
        //     statusCode: 403,
        //     message: 'Access restricted to Bangladesh, Nigeria and USA only.',
        //   };
        // }
      }

      const payload = { email: userDetails.email, sub: userDetails.id };
      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });

      return {
        success: true,
        statusCode: 200,
        authorization: {
          type: 'bearer',
          access_token: accessToken,
        },
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async revokeRefreshToken(user_id: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);
      if (!storedToken) {
        return {
          success: false,
          statusCode: 404,
          message: 'Refresh token not found',
        };
      }

      await this.redis.del(`refresh_token:${user_id}`);

      return {
        success: true,
        statusCode: 200,
        message: 'Refresh token revoked successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async forgotPassword(email) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: user.name,
          otp: token,
        });

        return {
          success: true,
          statusCode: 200,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          statusCode: 404,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  // verify otp
  async verifyOtp({ email, otp }) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: email,
          token: otp,
        });

        if (existToken) {
          return {
            success: true,
            statusCode: 200,
            message: 'OTP verified successfully',
          };
        } else {
          return {
            success: false,
            statusCode: 400,
            message: 'Invalid OTP',
          };
        }
      } else {
        return {
          success: false,
          statusCode: 404,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async resetPassword({ email, token, password }) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: email,
          token: token,
        });

        if (existToken) {
          await UserRepository.changePassword({
            email: email,
            password: password,
          });

          // delete otp code
          await UcodeRepository.deleteToken({
            email: email,
            token: token,
          });

          return {
            success: true,
            statusCode: 200,
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            statusCode: 400,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          statusCode: 404,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  // async verifyEmail({ email, token }) {
  //   try {
  //     const user = await UserRepository.exist({
  //       field: 'email',
  //       value: email,
  //     });

  //     if (user) {
  //       const existToken = await UcodeRepository.validateToken({
  //         email: email,
  //         token: token,
  //       });

  //       if (existToken) {
  //         await this.prisma.user.update({
  //           where: {
  //             id: user.id,
  //           },
  //           data: {
  //             email_verified_at: new Date(Date.now()),
  //           },
  //         });

  //         // delete otp code
  //         // await UcodeRepository.deleteToken({
  //         //   email: email,
  //         //   token: token,
  //         // });

  //         return {
  //           success: true,
  //           statusCode: 200,
  //           message: 'Email verified successfully',
  //         };
  //       } else {
  //         return {
  //           success: false,
  //           statusCode: 400,
  //           message: 'Invalid token',
  //         };
  //       }
  //     } else {
  //       return {
  //         success: false,
  //         statusCode: 404,
  //         message: 'Email not found',
  //       };
  //     }
  //   } catch (error) {
  //     return {
  //       success: false,
  //       statusCode: 500,
  //       message: error.message,
  //     };
  //   }
  // }

  async verifyEmail({ email, token }) {
    const user = await UserRepository.exist({
      field: 'email',
      value: email,
    });

    if (!user) {
      throw new HttpException('Email not found', HttpStatus.NOT_FOUND);
    }

    const existToken = await UcodeRepository.validateToken({
      email,
      token,
    });

    if (!existToken) {
      throw new HttpException('Invalid token', HttpStatus.BAD_REQUEST);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { email_verified_at: new Date() },
    });

    return {
      success: true,
      statusCode: 200,
      message: 'Email verified successfully',
    };
  }

  async resendVerificationEmail(email: string) {
    try {
      const user = await UserRepository.getUserByEmail(email);

      if (user) {
        // create otp code
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        // send otp code to email
        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: user.name,
          otp: token,
        });

        return {
          success: true,
          statusCode: 200,
          message: 'We have sent a verification code to your email',
        };
      } else {
        return {
          success: false,
          statusCode: 404,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async changePassword({ user_id, oldPassword, newPassword }) {
    try {
      const user = await UserRepository.getUserDetails(user_id);

      if (user) {
        const _isValidPassword = await UserRepository.validatePassword({
          email: user.email,
          password: oldPassword,
        });
        if (_isValidPassword) {
          await UserRepository.changePassword({
            email: user.email,
            password: newPassword,
          });

          return {
            success: true,
            statusCode: 200,
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            statusCode: 400,
            message: 'Old password is incorrect',
          };
        }
      } else {
        return {
          success: false,
          statusCode: 404,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async requestEmailChange(user_id: string, email: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
          email: email,
        });

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: email,
          otp: token,
        });

        return {
          success: true,
          statusCode: 200,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async changeEmail({
    user_id,
    new_email,
    token,
  }: {
    user_id: string;
    new_email: string;
    token: string;
  }) {
    try {
      const user = await UserRepository.getUserDetails(user_id);

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: new_email,
          token: token,
          forEmailChange: true,
        });

        if (existToken) {
          await UserRepository.changeEmail({
            user_id: user.id,
            new_email: new_email,
          });

          // delete otp code
          await UcodeRepository.deleteToken({
            email: new_email,
            token: token,
          });

          return {
            success: true,
            statusCode: 200,
            message: 'Email updated successfully',
          };
        } else {
          return {
            success: false,
            statusCode: 400,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  // --------- 2FA ---------
  async generate2FASecret(user_id: string) {
    try {
      return await UserRepository.generate2FASecret(user_id);
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async verify2FA(user_id: string, token: string) {
    try {
      const isValid = await UserRepository.verify2FA(user_id, token);
      if (!isValid) {
        return {
          success: false,
          statusCode: 400,
          message: 'Invalid token',
        };
      }
      return {
        success: true,
        statusCode: 200,
        message: '2FA verified successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async enable2FA(user_id: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        await UserRepository.enable2FA(user_id);
        return {
          success: true,
          statusCode: 200,
          message: '2FA enabled successfully',
        };
      } else {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async disable2FA(user_id: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        await UserRepository.disable2FA(user_id);
        return {
          success: true,
          statusCode: 200,
          message: '2FA disabled successfully',
        };
      } else {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }
  // --------- end 2FA ---------

  async disableAccount(user_id: string) {
    try {
      if (!user_id) {
        return {
          success: false,
          statusCode: 400,
          message: 'User ID is required',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { id: true, status: true },
      });

      if (!user) {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }

      if (user.status === 'INACTIVE') {
        return {
          success: false,
          statusCode: 400,
          message: 'User account is already disabled',
        };
      }

      await this.prisma.user.update({
        where: { id: user_id },
        data: { status: 'INACTIVE' }, // 0: Inactive
      });
      return {
        success: true,
        statusCode: 200,
        message: 'User account disabled successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async enableAccount(user_id: string) {
    try {
      if (!user_id) {
        return {
          success: false,
          statusCode: 400,
          message: 'User ID is required',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { id: true, status: true },
      });

      if (!user) {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }

      if (user.status === 'ACTIVE') {
        return {
          success: false,
          statusCode: 400,
          message: 'User account is already enabled',
        };
      }

      await this.prisma.user.update({
        where: { id: user_id },
        data: { status: 'ACTIVE' }, // 1: Active
      });
      return {
        success: true,
        statusCode: 200,
        message: 'User account enabled successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async deleteAccount(user_id: string) {
    try {
      if (!user_id) {
        return {
          success: false,
          statusCode: 400,
          message: 'User ID is required',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });

      if (!user) {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }

      const timestamp = new Date().getTime();

      // Soft delete and anonymize unique fields to allow re-registration
      await this.prisma.user.update({
        where: { id: user_id },
        data: {
          deleted_at: new Date(),
          status: 'INACTIVE',
          email: user.email ? `deleted_${timestamp}_${user.email}` : undefined,
          username: user.username
            ? `deleted_${timestamp}_${user.username}`
            : undefined,
          domain: user.domain
            ? `deleted_${timestamp}_${user.domain}`
            : undefined,
          google_id: null,
          facebook_id: null,
          apple_id: null,
        },
      });

      return {
        success: true,
        statusCode: 200,
        message: 'User account deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async helpSupport(userId: string, subject: string, message: string) {
    try {
      const user = await UserRepository.getUserDetails(userId);
      if (!user) {
        return {
          success: false,
          statusCode: 404,
          message: 'User not found',
        };
      }

      await this.prisma.supportRequest.create({
        data: {
          user_id: userId,
          name: user.name,
          email: user.email,
          subject,
          message,
        },
      });

      await this.mailService.sendSupportRequest({
        name: user.name,
        email: user.email,
        subject,
        message,
      });
      return {
        success: true,
        statusCode: 200,
        message: 'Support request sent successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async reportUser(
    reported_user_id: string,
    reporter_user_id: string,
    reason: string,
  ) {
    try {
      if (reported_user_id === reporter_user_id) {
        return {
          success: false,
          statusCode: 400,
          message: 'You cannot report yourself',
        };
      }

      const existingReport = await this.prisma.userReport.findFirst({
        where: {
          reported_id: reported_user_id,
          reporter_id: reporter_user_id,
        },
      });
      if (existingReport) {
        return {
          success: false,
          statusCode: 409,
          message: 'You have already reported this user',
        };
      }

      await this.prisma.userReport.create({
        data: {
          reported_id: reported_user_id,
          reporter_id: reporter_user_id,
          reason,
        },
      });
      return {
        success: true,
        statusCode: 200,
        message: 'User reported successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  //  =====================================================================
  async handleGoogleProfile(input: {
    googleId: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
    latitude?: number;
    longitude?: number;
  }) {
    const googleId = input.googleId;
    const email = input.email?.toLowerCase?.() ?? undefined;
    const firstName = input.firstName ?? undefined;
    const lastName = input.lastName ?? undefined;
    const avatar = input.avatar ?? undefined;
    const latitude = input.latitude;
    const longitude = input.longitude;

    if (!googleId) {
      throw new HttpException('googleId is required', HttpStatus.BAD_REQUEST);
    }

    const makeUsername = (): string | null => {
      const baseFromEmail = email?.split('@')?.[0];
      const base = (
        baseFromEmail || [firstName, lastName].filter(Boolean).join('')
      ).toLowerCase();
      const sanitized = base.replace(/[^a-z0-9_\.\-]/g, '');
      return sanitized || null;
    };

    // 1) Try by google_id first
    let user = await this.prisma.user.findUnique({
      where: { google_id: googleId },
    });

    // 2) If not found, try by email and link google_id
    if (!user && email) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      if (byEmail) {
        const enrichData: Prisma.UserUpdateInput = {
          google_id: byEmail.google_id ?? googleId,
          first_name: byEmail.first_name ?? firstName,
          last_name: byEmail.last_name ?? lastName,
          name:
            byEmail.name ??
            ([firstName, lastName].filter(Boolean).join(' ').trim() || null),
          avatar: byEmail.avatar ?? avatar,
          email_verified_at: byEmail.email_verified_at ?? new Date(),
        };

        if (!byEmail.username) {
          const candidate = makeUsername();
          if (candidate) {
            enrichData.username = candidate;
          }
        }

        try {
          user = await this.prisma.user.update({
            where: { id: byEmail.id },
            data: enrichData,
          });
        } catch (e: any) {
          // If username is taken, retry without setting username
          if (
            e?.code === 'P2002' &&
            Array.isArray(e?.meta?.target) &&
            e.meta.target.includes('username')
          ) {
            delete enrichData.username;
            user = await this.prisma.user.update({
              where: { id: byEmail.id },
              data: enrichData,
            });
          } else {
            throw e;
          }
        }
      }
    }

    // 3) If still not found, create a new user
    if (!user) {
      const baseData: Prisma.UserCreateInput = {
        google_id: googleId,
        email: email,
        first_name: firstName,
        last_name: lastName,
        name: [firstName, lastName].filter(Boolean).join(' ').trim() || null,
        avatar: avatar,
        email_verified_at: email ? new Date() : undefined,
      };

      const candidate = makeUsername();
      if (candidate) {
        baseData.username = candidate;
      }

      try {
        user = await this.prisma.user.create({ data: baseData });
      } catch (e: any) {
        if (
          e?.code === 'P2002' &&
          Array.isArray(e?.meta?.target) &&
          e.meta.target.includes('username')
        ) {
          // Retry creation without username to avoid collision
          delete baseData.username;
          user = await this.prisma.user.create({ data: baseData });
        } else {
          throw e;
        }
      }
    }

    // IMPORTANT: For mobile login, enforce the same geo rules as normal login.
    const loginResponse = await this.login({
      email: user.email,
      userId: user.id,
      latitude,
      longitude,
    });

    return {
      success: true,
      statusCode: 200,
      message: loginResponse?.message ?? 'Logged in successfully',
      authorization: loginResponse?.authorization,
      type: loginResponse?.type ?? user?.type,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
      },
    };
  }

  async handleAppleProfile(input: {
    appleId: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    latitude?: number;
    longitude?: number;
  }) {
    const appleId = input.appleId;
    const email = input.email?.toLowerCase?.() ?? undefined;
    const firstName = input.firstName ?? undefined;
    const lastName = input.lastName ?? undefined;
    const latitude = input.latitude;
    const longitude = input.longitude;

    if (!appleId) {
      throw new HttpException('appleId is required', HttpStatus.BAD_REQUEST);
    }

    // 1) Try by apple_id first
    let user = await this.prisma.user.findUnique({
      where: { apple_id: appleId },
    });

    // 2) If not found, try by email and link apple_id (best effort)
    if (!user && email) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      if (byEmail) {
        const enrichData: Prisma.UserUpdateInput = {
          apple_id: byEmail.apple_id ?? appleId,
          first_name: byEmail.first_name ?? firstName,
          last_name: byEmail.last_name ?? lastName,
          name:
            byEmail.name ??
            ([firstName, lastName].filter(Boolean).join(' ').trim() || null),
          email_verified_at: byEmail.email_verified_at ?? new Date(),
        };

        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: enrichData,
        });
      }
    }

    // 3) If still not found, create a new user
    if (!user) {
      // Apple may not provide email after the first login.
      // Create a stable synthetic email so downstream JWT payload + app logic remain consistent.
      const resolvedEmail = email ?? `apple_${appleId}@appleid.local`;

      const baseData: Prisma.UserCreateInput = {
        apple_id: appleId,
        email: resolvedEmail,
        first_name: firstName,
        last_name: lastName,
        name: [firstName, lastName].filter(Boolean).join(' ').trim() || null,
        email_verified_at: new Date(),
      };

      // username best-effort (optional)
      const baseUsername =
        resolvedEmail
          .split('@')[0]
          ?.toLowerCase?.()
          .replace(/[^a-z0-9_\.\-]/g, '') || null;
      if (baseUsername) {
        baseData.username = baseUsername;
      }

      try {
        user = await this.prisma.user.create({ data: baseData });
      } catch (e: any) {
        if (
          e?.code === 'P2002' &&
          Array.isArray(e?.meta?.target) &&
          e.meta.target.includes('username')
        ) {
          // Retry without username
          delete baseData.username;
          user = await this.prisma.user.create({ data: baseData });
        } else {
          throw e;
        }
      }
    }

    const loginResponse = await this.login({
      email: user.email,
      userId: user.id,
      latitude,
      longitude,
    });

    return {
      success: true,
      statusCode: 200,
      message: loginResponse?.message ?? 'Logged in successfully',
      authorization: loginResponse?.authorization,
      type: loginResponse?.type ?? user?.type,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
      },
    };
  }
}
