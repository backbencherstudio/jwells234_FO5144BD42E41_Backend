import { PartialType } from '@nestjs/mapped-types';
import { CreateShoutManageDto } from './create-shout_manage.dto';

export class UpdateShoutManageDto extends PartialType(CreateShoutManageDto) {}
