import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @ApiProperty()
  name?: string;

  @IsNotEmpty()
  @ApiProperty()
  email?: string;

  @IsNotEmpty()
  @ApiProperty()
  username: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8' })
  @ApiProperty()
  password: string;

  @ApiProperty({
    type: String,
    example: 'user',
  })
  type?: string;

  @IsNotEmpty()
  @ApiProperty()
  latitude: number;

  @IsNotEmpty()
  @ApiProperty()
  longitude: number;

  // avatar will be set in controller after file upload
  @IsOptional()
  @ApiProperty()
  avatar?: string;
  example: 'uploads/avatar12345.png';
}
