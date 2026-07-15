import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class RevenueCatEventDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  app_user_id: string;

  @IsString()
  @IsOptional()
  original_app_user_id?: string;

  @IsString()
  @IsNotEmpty()
  product_id: string;

  @IsString()
  @IsOptional()
  entitlement_id?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  entitlement_ids?: string[];

  @IsNumber()
  @IsNotEmpty()
  purchased_at_ms: number;

  @IsNumber()
  @IsOptional()
  expiration_at_ms?: number;

  @IsString()
  @IsOptional()
  period_type?: string;

  @IsString()
  @IsOptional()
  store?: string;

  @IsString()
  @IsOptional()
  environment?: string;

  @IsBoolean()
  @IsOptional()
  is_restore?: boolean;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  price_in_purchased_currency?: number;

  @IsString()
  @IsOptional()
  transaction_id?: string;

  @IsString()
  @IsOptional()
  original_transaction_id?: string;

  @IsNumber()
  @IsOptional()
  takehome_percentage?: number;

  @IsNumber()
  @IsOptional()
  tax_percentage?: number;

  @IsNumber()
  @IsOptional()
  commission_percentage?: number;
}

export class RevenueCatWebhookDto {
  @IsString()
  @IsNotEmpty()
  api_version: string;

  @ValidateNested()
  @Type(() => RevenueCatEventDto)
  @IsNotEmpty()
  event: RevenueCatEventDto;
}
