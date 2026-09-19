import { IsNotEmpty, IsString, IsNumberString, Length, IsOptional } from 'class-validator';

export class ChargeCardDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsNumberString()
  @Length(16, 19)
  cardNumber: string;

  @IsNumberString()
  @Length(3, 4)
  cvv: string;

  @IsNumberString()
  @Length(2, 2)
  expiryMonth: string;

  @IsNumberString()
  @Length(2, 2)
  expiryYear: string;

  @IsOptional()
  @IsNumberString()
  pin?: string;
}

export class SubmitOtpDto {
  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsString()
  @IsNotEmpty()
  otp: string;
}
