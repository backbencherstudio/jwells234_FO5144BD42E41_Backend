// external imports
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
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
      const isAllowed = await LocationService.isLocationAllowed(
        latitude,
        longitude,
      );
      if (!isAllowed) {
        throw new ForbiddenException(
          'Access restricted to Bangladesh and Nigeria only.',
        );
      }

      // Check if email already exist
      const userEmailExist = await UserRepository.exist({
        field: 'email',
        value: String(email),
      });

      if (userEmailExist) {
        return {
          statusCode: 401,
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
        message: 'We have sent an OTP code to your email',
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
        message: 'Account created successfully',
      };
    } catch (error) {
      return {
        success: false,
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
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
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
        };
      }

      if (user) {
        return {
          success: true,
          data: user,
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
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
        return { success: false, message: 'User not found' };
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
          message: 'User updated successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
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
      // Check location
      if (latitude === undefined || longitude === undefined) {
        throw new ForbiddenException('Location coordinates are required.');
      }
      const isAllowed = await LocationService.isLocationAllowed(
        latitude,
        longitude,
      );
      if (!isAllowed) {
        throw new ForbiddenException(
          'Access restricted to Bangladesh and Nigeria only.',
        );
      }

      const payload = { email: email, sub: userId };

      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

      const user = await UserRepository.getUserDetails(userId);

      // store refreshToken
      await this.redis.set(
        `refresh_token:${user.id}`,
        refreshToken,
        'EX',
        60 * 60 * 24 * 7, // 7 days in seconds
      );

      return {
        success: true,
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
          message: 'User created but failed to create billing account',
        };
      }

      return {
        message: 'Logged in successfully',
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
        message: error.message,
      };
    }
  }

  // apple log in using passport.js
  async appleLogin({
    email,
    userId,
    aud,
  }: {
    email: string;
    userId: string;
    aud: string;
  }) {
    try {
      const payload = { email, sub: userId, aud };

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
          message: 'User created but failed to create billing account',
        };
      }

      return {
        message: 'Logged in successfully',
        authorization: {
          type: 'bearer',
          access_token: accessToken,
          refresh_token: refreshToken,
        },
        type: user.type,
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async refreshToken(
    user_id: string,
    refreshToken: string,
    latitude?: number,
    longitude?: number,
  ) {
    try {
      // Check location if provided (Mobile App Re-open Scenario)
      if (latitude !== undefined && longitude !== undefined) {
        const isAllowed = await LocationService.isLocationAllowed(
          latitude,
          longitude,
        );
        if (!isAllowed) {
          throw new ForbiddenException(
            'Access restricted to Bangladesh and Nigeria only.',
          );
        }
      }

      const storedToken = await this.redis.get(`refresh_token:${user_id}`);

      if (!storedToken || storedToken != refreshToken) {
        return {
          success: false,
          message: 'Refresh token is required',
        };
      }

      if (!user_id) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const userDetails = await UserRepository.getUserDetails(user_id);
      if (!userDetails) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const payload = { email: userDetails.email, sub: userDetails.id };
      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });

      return {
        success: true,
        authorization: {
          type: 'bearer',
          access_token: accessToken,
        },
      };
    } catch (error) {
      return {
        success: false,
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
          message: 'Refresh token not found',
        };
      }

      await this.redis.del(`refresh_token:${user_id}`);

      return {
        success: true,
        message: 'Refresh token revoked successfully',
      };
    } catch (error) {
      return {
        success: false,
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
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
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
            message: 'OTP verified successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid OTP',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
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
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async verifyEmail({ email, token }) {
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
          await this.prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              email_verified_at: new Date(Date.now()),
            },
          });

          // delete otp code
          // await UcodeRepository.deleteToken({
          //   email: email,
          //   token: token,
          // });

          return {
            success: true,
            message: 'Email verified successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
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
          message: 'We have sent a verification code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
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
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid password',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
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
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
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
            message: 'Email updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
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
          message: 'Invalid token',
        };
      }
      return {
        success: true,
        message: '2FA verified successfully',
      };
    } catch (error) {
      return {
        success: false,
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
          message: '2FA enabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
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
          message: '2FA disabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
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
          message: 'User ID is required',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { id: true },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      await this.prisma.user.update({
        where: { id: user_id },
        data: { status: 'INACTIVE' }, // 0: Inactive
      });
      return {
        success: true,
        message: 'User account disabled successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async enableAccount(user_id: string) {
    try {
      if (!user_id) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { id: true },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      await this.prisma.user.update({
        where: { id: user_id },
        data: { status: 'ACTIVE' }, // 1: Active
      });
      return {
        success: true,
        message: 'User account enabled successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteAccount(user_id: string) {
    try {
      if (!user_id) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { id: true },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Soft delete
      await this.prisma.user.update({
        where: { id: user_id },
        data: { deleted_at: new Date() },
      });

      return {
        success: true,
        message: 'User account deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async helpSupport(
    name: string,
    email: string,
    subject: string,
    message: string,
  ) {
    try {
      await this.mailService.sendSupportRequest({
        name,
        email,
        subject,
        message,
      });
      return {
        success: true,
        message: 'Support request sent successfully',
      };
    } catch (error) {
      return {
        success: false,
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
        message: 'User reported successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
