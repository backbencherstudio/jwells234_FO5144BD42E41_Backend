import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class GoogleMobileDto {
  @ApiProperty({
    description: 'Google ID token from Flutter (GoogleSignInAuthentication.idToken)',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;

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
