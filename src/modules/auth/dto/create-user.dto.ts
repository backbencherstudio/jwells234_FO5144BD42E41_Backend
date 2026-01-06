import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, MinLength, IsString } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @ApiProperty({
    type: String,
    example: 'user',
  })
  type?: string;

  @IsOptional()
  @ApiProperty()
  latitude: number;

  @IsOptional()
  @ApiProperty()
  longitude: number;

  // avatar will be set in controller after file upload
  @IsOptional()
  @ApiProperty()
  avatar?: string;
  example: 'uploads/avatar12345.png';
}
