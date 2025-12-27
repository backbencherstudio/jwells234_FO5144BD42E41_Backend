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
import { ShoutManageService } from './shout_manage.service';
import { CreateShoutManageDto } from './dto/create-shout_manage.dto';
import { UpdateShoutManageDto } from './dto/update-shout_manage.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { UpdateStatusDto } from './dto/update-status.dto';

@ApiBearerAuth()
@ApiTags('Shout Manage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/shout')
export class ShoutManageController {
  constructor(private readonly shoutManageService: ShoutManageService) {}

  @ApiOperation({ summary: 'Get all shouts' })
  @Get()
  async getAllShouts() {
    try {
      const shouts = await this.shoutManageService.getAllShouts();
      return shouts;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Content management by user with date filter' })
  @Get('content-management')
  async contentManagementByUser(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    try {
      const result = await this.shoutManageService.contentManagementByUser(
        startDate,
        endDate,
      );
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get shout by ID' })
  @Get(':id')
  async getShoutById(@Param('id') id: string) {
    try {
      const shout = await this.shoutManageService.getShoutById(id);
      return shout;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Update shout status' })
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: UpdateStatusDto) {
    try {
      const shout = await this.shoutManageService.updateStatus(id, body);
      return shout;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Delete shout by ID' })
  @Delete(':id')
  async deleteShout(@Param('id') id: string) {
    try {
      const result = await this.shoutManageService.deleteShout(id);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
