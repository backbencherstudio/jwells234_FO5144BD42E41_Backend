import { Controller, Get, Patch, Param, UseGuards, Delete } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';

@ApiTags('Notification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiOperation({ summary: 'Get all notifications for the current user' })
  @Get()
  getAllNotifications(@GetUser() user) {
    return this.notificationService.getAllNotifications(user.userId);
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Patch('read-all')
  markAllAsRead(@GetUser() user) {
    return this.notificationService.markAllAsRead(user.userId);
  }

  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @Patch(':id/read')
  markAsRead(@GetUser() user, @Param('id') id: string) {
    return this.notificationService.markAsRead(user.userId, id);
  }

  @ApiOperation({ summary: 'Mark a specific notification as unread' })
  @Patch(':id/unread')
  markAsUnread(@GetUser() user, @Param('id') id: string) {
    return this.notificationService.markAsUnread(user.userId, id);
  }

  @ApiOperation({ summary: 'Delete a specific notification' })
  @Delete(':id/delete')
  deleteNotification(@GetUser() user, @Param('id') id: string) {
    return this.notificationService.deleteNotification(user.userId, id);
  }
}
