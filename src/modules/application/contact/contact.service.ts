import { Injectable } from '@nestjs/common';
import { CreateContactDto } from './dto/create-contact.dto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MailService } from '../../../mail/mail.service';

@Injectable()
export class ContactService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async create(createContactDto: CreateContactDto, user: any) {
    try {
      if (!createContactDto.message) {
        throw new Error('Message is required');
      }

      const firstName = user?.first_name || 'Guest';
      const lastName = user?.last_name || 'User';
      const email = user?.email || 'guest@example.com';

      await this.prisma.contact.create({
        data: {
          first_name: firstName,
          last_name: lastName,
          email: email,
          message: createContactDto.message,
        },
      });

      await this.mailService.sendSupportRequest({
        name: `${firstName} ${lastName}`,
        email: email,
        subject: 'New Contact Message',
        message: createContactDto.message,
      });

      return {
        success: true,
        statusCode: 200,
        message: 'Submitted successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }
}
