import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportQueryDto, ReportType } from './dto/report-query.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { WarnUserDto } from './dto/warn-user.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Role } from 'src/common/guard/role/role.enum';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { RolesGuard } from 'src/common/guard/role/roles.guard';

@ApiBearerAuth()
@ApiTags('Reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Get report analytics' })
  @Get('analytics')
  async getAnalytics() {
    return this.reportsService.getAnalytics();
  }

  @ApiOperation({ summary: 'Get all reports' })
  @Get()
  async findAll(@Query() query: ReportQueryDto) {
    return this.reportsService.findAll(query);
  }

  @ApiOperation({ summary: 'Get report details' })
  @ApiQuery({ name: 'type', enum: ReportType, required: true })
  @Get(':id')
  async findOne(@Param('id') id: string, @Query('type') type: ReportType) {
    return this.reportsService.findOne(id, type);
  }

  @ApiOperation({ summary: 'Update report status' })
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, body.type, body.status);
  }

  @ApiOperation({
    summary: 'Warn user and send notification to reported & reporter user',
  })
  @Post('warn')
  async warnUser(@Body() body: WarnUserDto) {
    return this.reportsService.warnUser(body);
  }

  @ApiOperation({ summary: 'Remove warning from user' })
  @Post('remove-warning')
  async removeWarning(@Body() body: { userId: string }) {
    return this.reportsService.removeWarning(body.userId);
  }

  @ApiOperation({ summary: 'Ban user' })
  @Post('ban')
  async banUser(@Body() body: BanUserDto) {
    return this.reportsService.banUser(body);
  }

  @ApiOperation({ summary: 'Unban user' })
  @Post('unban')
  async unbanUser(@Body() body: { userId: string }) {
    return this.reportsService.unbanUser(body.userId);
  }

  @ApiOperation({ summary: 'Send message to user' })
  @Post('message')
  async sendMessage(@Body() body: SendMessageDto) {
    return this.reportsService.sendMessage(body.userId, body.message);
  }

  @ApiOperation({ summary: 'Delete report' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.reportsService.remove(id);
  }
}
