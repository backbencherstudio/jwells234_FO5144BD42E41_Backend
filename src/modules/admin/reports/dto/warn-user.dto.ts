import { IsArray, IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportType } from './report-query.dto';
import { ReportStatus } from '@prisma/client';

export class WarnUserDto {
  @ApiProperty({ description: 'ID of the user being reported/warned' })
  @IsNotEmpty()
  @IsString()
  reportedId: string;

  @ApiPropertyOptional({ description: 'ID of the user who made the report' })
  @IsOptional()
  @IsString()
  reporterId?: string;

  @ApiPropertyOptional({ description: 'Message to be included in notification' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ description: 'List of reasons for the warning' })
  @IsArray()
  @IsString({ each: true })
  reasons: string[];
  
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
