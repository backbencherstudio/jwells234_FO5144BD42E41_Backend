import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AppleMobileDto {
  @ApiProperty({
    description:
      'Apple identity token (JWT) from Flutter sign_in_with_apple credential.identityToken',
  })
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @ApiProperty({ required: false, description: 'Apple email (may be present only on first login)' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: false, example: 23.8103 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiProperty({ required: false, example: 90.4125 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}
