import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class CreateContactDto {

  @IsNotEmpty()
  @ApiProperty()
  message: string;
}
