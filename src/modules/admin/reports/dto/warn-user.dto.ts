import { IsArray, IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportType } from './report-query.dto';
import { ReportStatus } from '@prisma/client';

export class WarnUserDto {
  @ApiPropertyOptional({ description: 'ID of the user being warned (override; normally inferred from reportId+type)' })
  @IsOptional()
  @IsString()
  reportedId?: string;

  @ApiPropertyOptional({ description: 'ID of the reporting user (override; normally inferred from reportId+type)' })
  @IsOptional()
  @IsString()
  reporterId?: string;

  @ApiPropertyOptional({ description: 'Optional custom message for the warned user' })
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
