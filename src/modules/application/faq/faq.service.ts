import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FaqService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    try {
      const faqs = await this.prisma.faq.findMany({
        orderBy: {
          sort_order: 'asc',
        },
        select: {
          id: true,
          question: true,
          answer: true,
        },
      });
      return {
        success: true,
        statusCode: 200,
        data: faqs,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async findOne(id: string) {
    try {
      const faq = await this.prisma.faq.findUnique({
        where: { id },
        select: {
          id: true,
          question: true,
          answer: true,
        },
      });

      if (!faq) {
        return {
          success: false,
          statusCode: 404,
          message: 'FAQ not found',
        };
      }

      return {
        success: true,
        statusCode: 200,
        data: faq,
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
