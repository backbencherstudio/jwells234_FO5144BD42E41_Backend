import { ApiProperty } from '@nestjs/swagger';
import { CreateContactDto } from './create-contact.dto';
import { IsNotEmpty } from 'class-validator';

export class UpdateContactDto {
  // get status from enum ContactStatus

  @ApiProperty({ description: 'Status of the contact message' })
  @IsNotEmpty()
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
}
