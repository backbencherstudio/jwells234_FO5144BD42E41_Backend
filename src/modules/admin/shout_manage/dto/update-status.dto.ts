import { IsEnum, IsNotEmpty } from 'class-validator';
import { ShoutStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsNotEmpty()
  @IsEnum(ShoutStatus)
  status: ShoutStatus;
}
