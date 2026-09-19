import { Controller, Post, Body, Res } from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { Response } from 'express';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @ApiOperation({ summary: 'Create contact' })
  @Post()
  async create(
    @Body() createContactDto: CreateContactDto,
    @GetUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const contact: any = await this.contactService.create(createContactDto, user);
      if (contact.statusCode) {
        res.status(contact.statusCode);
      }
      return contact;
    } catch (error) {
       res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }
}
