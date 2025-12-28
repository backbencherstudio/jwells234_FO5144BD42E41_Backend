import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  getOverview(@Query('period') period: 'year' | 'month' | 'week' | 'all') {
    return this.dashboardService.getOverview(period);
  }
}
