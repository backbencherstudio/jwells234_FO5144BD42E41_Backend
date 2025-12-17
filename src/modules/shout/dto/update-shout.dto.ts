import { PartialType } from '@nestjs/swagger';
import { CreateShoutDto } from './create-shout.dto';

export class UpdateShoutDto extends PartialType(CreateShoutDto) {}
