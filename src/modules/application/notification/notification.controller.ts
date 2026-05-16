import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Delete,
  Res,
  Body,
  Post,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { Response } from 'express';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UnregisterDeviceTokenDto } from './dto/unregister-device-token.dto';

@ApiTags('Notification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiOperation({ summary: 'Register mobile device token for push notification' })
  @Post('device-token/register')
  async registerDeviceToken(
    @GetUser() user,
    @Body() dto: RegisterDeviceTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response = await this.notificationService.registerDeviceToken(
        user.userId,
        dto,
      );
      return response;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Unregister mobile device token for push notification' })
  @Post('device-token/unregister')
  async unregisterDeviceToken(
    @GetUser() user,
    @Body() dto: UnregisterDeviceTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response = await this.notificationService.unregisterDeviceToken(
        user.userId,
        dto,
      );
      return response;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get all notifications for the current user' })
  @Get()
  async getAllNotifications(
    @GetUser() user,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response = await this.notificationService.getAllNotifications(
        user.userId,
      );
      return response;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Patch('read-all')
  async markAllAsRead(
    @GetUser() user,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response = await this.notificationService.markAllAsRead(
        user.userId,
      );
      return response;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @Patch(':id/read')
  async markAsRead(
    @GetUser() user,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response = await this.notificationService.markAsRead(
        user.userId,
        id,
      );
      return response;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Mark a specific notification as unread' })
  @Patch(':id/unread')
  async markAsUnread(
    @GetUser() user,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response = await this.notificationService.markAsUnread(
        user.userId,
        id,
      );
      return response;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Delete a specific notification' })
  @Delete(':id/delete')
  async deleteNotification(
    @GetUser() user,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response = await this.notificationService.deleteNotification(
        user.userId,
        id,
      );
      return response;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }
}
