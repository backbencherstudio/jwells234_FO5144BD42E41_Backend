import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import appConfig from '../../config/app.config';
import { AuthGuard } from '@nestjs/passport';
import { AppleAuthGuard } from './guards/apple-auth.guard';
import { GetUser } from './decorators/get-user.decorator';

import { LocationGuard } from '../../common/guard/location.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private getResponseStatusCode(payload: unknown): number | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    if (!('statusCode' in payload)) return undefined;

    const statusCode = (payload as { statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : undefined;
  }

  private sendResponse(res: Response, payload: unknown, defaultStatusCode = HttpStatus.OK) {
    const statusCode = this.getResponseStatusCode(payload) ?? defaultStatusCode;
    return res.status(statusCode).json(payload);
  }

  private sendError(res: Response, error: any, fallbackMessage: string) {
    const statusCode = error?.getStatus ? error.getStatus() : error?.status || 500;
    return res.status(statusCode).json({
      success: false,
      statusCode,
      message: error?.message || fallbackMessage,
    });
  }

  @ApiOperation({ summary: 'Get user details' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request, @Res() res: Response) {
    try {
      // console.log(req.user);
      const user_id = req.user.userId;

      const response = await this.authService.me(user_id);

      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to fetch user details');
    }
  }

  @ApiOperation({ summary: 'Register a user' })
  @Post('register')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
    }),
  )
  async create(
    @Req() req: Request,
    @Body() data: CreateUserDto,
    @Res() res: Response,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    try {
      const name = data.name;
      const email = data.email;
      const username = data.username;
      const password = data.password;
      const type = data.type;

      let latitude = data.latitude;
      let longitude = data.longitude;

      if (latitude === undefined || longitude === undefined) {
        latitude = req.headers['x-latitude']
          ? parseFloat(req.headers['x-latitude'] as string)
          : undefined;
        longitude = req.headers['x-longitude']
          ? parseFloat(req.headers['x-longitude'] as string)
          : undefined;
      }

      const avatarFile = avatar;

      // console.log('hello', avatarFile);

      if (!name) {
        throw new HttpException('Name not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!username) {
        throw new HttpException(
          'Username not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (!password) {
        throw new HttpException(
          'Password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (!latitude || !longitude) {
        throw new HttpException(
          'Location (latitude and longitude) is required',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const response = await this.authService.register({
        name: name,
        email: email,
        username: username,
        password: password,
        type: type,
        avatar: avatarFile,
        latitude: latitude,
        longitude: longitude,
      });

      return this.sendResponse(res, response, HttpStatus.CREATED);
    } catch (error) {
      return this.sendError(res, error, 'Failed to register');
    }
  }

  // login user
  @ApiOperation({ summary: 'Login user' })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: Request, @Res() res: Response) {
    try {
      // console.log("user", req.user);
      const user_id = req.user.id;

      const user_email = req.user.email;

      let latitude = req.body.latitude;
      let longitude = req.body.longitude;

      if (latitude === undefined || longitude === undefined) {
        latitude = req.headers['x-latitude']
          ? parseFloat(req.headers['x-latitude'] as string)
          : undefined;
        longitude = req.headers['x-longitude']
          ? parseFloat(req.headers['x-longitude'] as string)
          : undefined;
      }

      const response = await this.authService.login({
        userId: user_id,
        email: user_email,
        latitude,
        longitude,
      });

      // store to secure cookies
      res.cookie('refresh_token', response.authorization.refresh_token, {
        httpOnly: true,
        secure: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      });

      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to login');
    }
  }

  @ApiOperation({ summary: 'Refresh token' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('refresh-token')
  async refreshToken(
    @Req() req: Request,
    @Res() res: Response,
    @Body()
    body: { refresh_token: string; latitude?: number; longitude?: number },
  ) {
    try {
      const user_id = req.user.userId;

      let latitude = body.latitude;
      let longitude = body.longitude;

      if (latitude === undefined || longitude === undefined) {
        latitude = req.headers['x-latitude']
          ? parseFloat(req.headers['x-latitude'] as string)
          : undefined;
        longitude = req.headers['x-longitude']
          ? parseFloat(req.headers['x-longitude'] as string)
          : undefined;
      }

      const response = await this.authService.refreshToken(
        user_id,
        body.refresh_token,
        latitude,
        longitude,
      );

      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to refresh token');
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req.user.userId;
      const response = await this.authService.revokeRefreshToken(userId);
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to logout');
    }
  }

  // google login
  @ApiOperation({ summary: 'Google login' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleLogin(): Promise<any> {
    return HttpStatus.OK;
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    const { user, loginResponse } = req.user;

    // Now, return the JWT tokens and the user info
    return res.json({
      message: 'Logged in successfully via Google',
      authorization: loginResponse.authorization,
      user: {
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar: user.avatar,
      },
    });
  }

  // apple login
  @Get('apple')
  @UseGuards(AppleAuthGuard)
  async appleAuth(@Req() req) {
    return HttpStatus.OK;
  }

  @Get('apple/redirect')
  @UseGuards(AppleAuthGuard)
  async appleAuthRedirect(@Req() req, @Res() res: Response) {
    const { user, loginResponse } = req.user;

    return res.json({
      message: 'Logged in successfully via Apple',
      authorization: loginResponse.authorization,
      user: {
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar: user.avatar,
      },
    });
  }

  // update user
  @ApiOperation({ summary: 'Update user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('update')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
    }),
  )
  async updateUser(
    @Req() req: any,
    @Body() data: UpdateUserDto,
    @UploadedFile() avatar: Express.Multer.File,
    @Res() res: Response,
  ) {
    try {
      const user_id = req.user.userId;

      if (data.latitude === undefined || data.longitude === undefined) {
        const latHeader = req.headers['x-latitude'];
        const lngHeader = req.headers['x-longitude'];
        if (latHeader && lngHeader) {
          data.latitude = parseFloat(latHeader as string);
          data.longitude = parseFloat(lngHeader as string);
        }
      }

      const response = await this.authService.updateUser(user_id, data, avatar);
      // console.log('user_id', user_id);
      // console.log('data', data);
      // console.log('avatar', avatar);
      // console.log('response', response);
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to update user');
    }
  }

  // --------------change password---------

  @ApiOperation({ summary: 'Forgot password' })
  @Post('forgot-password')
  async forgotPassword(
    @Body() data: { email: string },
    @Res() res: Response,
  ) {
    try {
      const email = data.email;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      const response = await this.authService.forgotPassword(email);
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Something went wrong');
    }
  }

  // verify email to verify the email
  @ApiOperation({ summary: 'Verify email' })
  @Post('verify-email')
  async verifyEmail(@Body() data: VerifyEmailDto, @Res() res: Response) {
    try {
      const email = data.email;
      const token = data.otp;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!token) {
        throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
      }

      const response = await this.authService.verifyEmail({
        email: data.email,
        token: data.otp,
      });

      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to verify email');
    }
  }

  // resend verification email to verify the email
  @ApiOperation({ summary: 'Resend verification email' })
  @Post('resend-verification-email')
  async resendVerificationEmail(
    @Body() data: { email: string },
    @Res() res: Response,
  ) {
    try {
      const email = data.email;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      const response = await this.authService.resendVerificationEmail(email);
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to resend verification email');
    }
  }

  // reset password if user forget the password
  @ApiOperation({ summary: 'Reset password' })
  @Post('reset-password')
  async resetPassword(
    @Body() data: { email: string; otp: string; new_password: string },
    @Res() res: Response,
  ) {
    try {
      const email = data.email;
      const token = data.otp;
      const password = data.new_password;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!token) {
        throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!password) {
        throw new HttpException(
          'Password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      const response = await this.authService.resetPassword({
        email: email,
        token: token,
        password: password,
      });
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Something went wrong');
    }
  }

  // change password if user want to change the password
  @ApiOperation({ summary: 'Change password' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Req() req: Request,
    @Body() data: { email: string; old_password: string; new_password: string },
    @Res() res: Response,
  ) {
    try {
      // const email = data.email;
      const user_id = req.user.userId;

      const oldPassword = data.old_password;
      const newPassword = data.new_password;
      // if (!email) {
      //   throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      // }
      if (!oldPassword) {
        throw new HttpException(
          'Old password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (!newPassword) {
        throw new HttpException(
          'New password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      const response = await this.authService.changePassword({
        // email: email,
        user_id: user_id,
        oldPassword: oldPassword,
        newPassword: newPassword,
      });
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to change password');
    }
  }

  // --------------end change password---------

  // -------change email address------
  @ApiOperation({ summary: 'request email change' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('request-email-change')
  async requestEmailChange(
    @Req() req: Request,
    @Body() data: { email: string },
    @Res() res: Response,
  ) {
    try {
      const user_id = req.user.userId;
      const email = data.email;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      const response = await this.authService.requestEmailChange(
        user_id,
        email,
      );
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Something went wrong');
    }
  }

  @ApiOperation({ summary: 'Change email address' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('change-email')
  async changeEmail(
    @Req() req: Request,
    @Body() data: { email: string; token: string },
    @Res() res: Response,
  ) {
    try {
      const user_id = req.user.userId;
      const email = data.email;

      const token = data.token;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!token) {
        throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
      }
      const response = await this.authService.changeEmail({
        user_id: user_id,
        new_email: email,
        token: token,
      });
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Something went wrong');
    }
  }
  // -------end change email address------

  // --------- 2FA ---------
  @ApiOperation({ summary: 'Generate 2FA secret' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('generate-2fa-secret')
  async generate2FASecret(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const user_id = req.user.userId;
      const response = await this.authService.generate2FASecret(user_id);
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to generate 2FA secret');
    }
  }

  @ApiOperation({ summary: 'Verify 2FA' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('verify-2fa')
  async verify2FA(
    @Req() req: Request,
    @Body() data: { token: string },
    @Res() res: Response,
  ) {
    try {
      const user_id = req.user.userId;
      const token = data.token;
      const response = await this.authService.verify2FA(user_id, token);
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to verify 2FA');
    }
  }

  @ApiOperation({ summary: 'Enable 2FA' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('enable-2fa')
  async enable2FA(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const user_id = req.user.userId;
      const response = await this.authService.enable2FA(user_id);
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to enable 2FA');
    }
  }

  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('disable-2fa')
  async disable2FA(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const user_id = req.user.userId;
      const response = await this.authService.disable2FA(user_id);
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to disable 2FA');
    }
  }
  // --------- end 2FA ---------

  @ApiOperation({ summary: 'Disable user account' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('disable-account')
  async disableAccount(
    @GetUser() user,
    @Res() res: Response,
  ) {
    try {
      const user_id = user.userId;
      const response = await this.authService.disableAccount(user_id);
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to disable account');
    }
  }

  @ApiOperation({ summary: 'Enable user account' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('enable-account')
  async enableAccount(
    @GetUser() user,
    @Res() res: Response,
  ) {
    try {
      const user_id = user.userId;
      const response = await this.authService.enableAccount(user_id);
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to enable account');
    }
  }

  @ApiOperation({ summary: 'Delete account' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('delete-account')
  async deleteAccount(
    @GetUser() user,
    @Res() res: Response,
  ) {
    try {
      const user_id = user.userId;
      const response = await this.authService.deleteAccount(user_id);
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to delete account');
    }
  }

  @ApiOperation({ summary: 'Halp support' })
  @Post('help-support')
  async helpSupport(
    @GetUser() user,
    @Body()
    data: {
      name: string;
      email: string;
      subject: string;
      message: string;
    },
    @Res() res: Response,
  ) {
    try {
      const name = user.name;
      const email = user.email;

      const subject = data.subject;
      const message = data.message;

      if (!name) {
        throw new HttpException('Name not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!message) {
        throw new HttpException(
          'Message not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const response = await this.authService.helpSupport(
        name,
        email,
        subject,
        message,
      );

      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to send support request');
    }
  }

  @ApiOperation({ summary: 'Report an user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('report-user')
  async reportUser(
    @GetUser() user,
    @Body()
    data: {
      reported_user_id: string;
      reason: string;
    },
    @Res() res: Response,
  ) {
    try {
      const reporting_user_id = user.userId;
      const reported_user_id = data.reported_user_id;
      const reason = data.reason;
      if (!reported_user_id) {
        throw new HttpException(
          'Reported user ID not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (!reason) {
        throw new HttpException('Reason not provided', HttpStatus.UNAUTHORIZED);
      }
      const response = await this.authService.reportUser(
        reporting_user_id,
        reported_user_id,
        reason,
      );
      return this.sendResponse(res, response);
    } catch (error) {
      return this.sendError(res, error, 'Failed to report user');
    }
  }
}
