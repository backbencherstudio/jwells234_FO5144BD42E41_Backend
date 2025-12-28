import {
  Controller,
  Get,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { PaymentTransactionService } from './payment-transaction.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { PaymentQueryDto } from './dto/payment-query.dto';

@ApiBearerAuth()
@ApiTags('Payment transaction')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/payment-transaction')
export class PaymentTransactionController {
  constructor(
    private readonly paymentTransactionService: PaymentTransactionService,
  ) {}

  @ApiOperation({ summary: 'Get payment analytics' })
  @Get('analytics')
  async getAnalytics() {
    return this.paymentTransactionService.getAnalytics();
  }

  @ApiOperation({ summary: 'Get all payment transactions' })
  @Get()
  async findAll(@Query() query: PaymentQueryDto) {
    return this.paymentTransactionService.findAll(query);
  }

  @ApiOperation({ summary: 'Get transaction details' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.paymentTransactionService.findOne(id);
  }
}
