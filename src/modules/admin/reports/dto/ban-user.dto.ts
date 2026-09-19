import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportType } from './report-query.dto';
import { ReportStatus } from '@prisma/client';

export class BanUserDto {
  @ApiPropertyOptional({ description: 'ID of the user being banned (override; normally inferred from reportId+type)' })
  @IsOptional()
  @IsString()
  reportedId?: string;

  @ApiPropertyOptional({ description: 'ID of the user who made the report' })
  @IsOptional()
  @IsString()
  reporterId?: string;

  @ApiPropertyOptional({ description: 'Optional custom message for the banned user' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Reason for the ban' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'ID of the report to update' })
  @IsOptional()
  @IsString()
  reportId?: string;

  @ApiPropertyOptional({ description: 'Type of the report (SHOUT/USER)', enum: ReportType })
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @ApiPropertyOptional({ description: 'New status for the report', enum: ReportStatus })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;
}
