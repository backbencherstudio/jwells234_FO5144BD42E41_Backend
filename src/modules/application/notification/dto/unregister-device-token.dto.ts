import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UnregisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;
}
