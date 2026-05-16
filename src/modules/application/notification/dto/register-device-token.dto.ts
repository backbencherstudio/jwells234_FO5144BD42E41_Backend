import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;

  @IsOptional()
  @IsString()
  @IsIn(['android', 'ios', 'web'])
  platform?: string;
}
