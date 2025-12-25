import { Injectable } from '@nestjs/common';
import { CreateContactDto } from './dto/create-contact.dto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ContactService {
  constructor(private prisma: PrismaService) {}

  async create(createContactDto: CreateContactDto, user: any) {
    try {

      if (!createContactDto.message) {
        throw new Error('Message is required');
      }

      await this.prisma.contact.create({
        data: {
          first_name: user?.first_name || 'Guest',
          last_name: user?.last_name || 'User',
          email: user?.email || 'guest@example.com',
          message: createContactDto.message,
        },
      });

      return {
        success: true,
        message: 'Submitted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
