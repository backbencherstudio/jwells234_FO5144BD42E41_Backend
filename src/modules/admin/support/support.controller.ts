import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiBearerAuth()
@ApiTags('Support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @ApiOperation({ summary: 'Get all support requests' })
  @Get()
  async getAllSupportRequests() {
    return this.supportService.getAllSupportRequests();
  }

  @ApiOperation({ summary: 'Get support request by ID' })
  @Get(':id')
  async getSupportRequestById(@Param('id') id: string) {
    return this.supportService.getSupportRequestById(id);
  }

  @ApiOperation({ summary: 'Delete support request by ID' })
  @Delete(':id')
  async deleteSupportRequest(@Param('id') id: string) {
    return this.supportService.deleteSupportRequest(id);
  }

  @ApiOperation({ summary: 'Update support request status' })
  @Patch(':id/status')
  async updateSupportRequestStatus(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const status = typeof body === 'string' ? body : body?.status;
    return this.supportService.updateSupportRequestStatus(id, status);
  }
}
