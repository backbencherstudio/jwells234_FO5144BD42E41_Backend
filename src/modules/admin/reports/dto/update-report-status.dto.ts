import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ReportStatus } from '@prisma/client';
import { ReportType } from './report-query.dto';

export class UpdateReportStatusDto {
  @ApiProperty({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiProperty({ enum: ReportType })
  @IsEnum(ReportType)
  type: ReportType;
}
