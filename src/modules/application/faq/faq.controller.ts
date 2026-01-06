import { Controller, Get, Param, Res } from '@nestjs/common';
import { FaqService } from './faq.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('Faq')
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @ApiOperation({ summary: 'Get all faq' })
  @Get()
  async findAll(@Res({ passthrough: true }) res: Response) {
    try {
      const faqs: any = await this.faqService.findAll();
      if (faqs.statusCode) {
        res.status(faqs.statusCode);
      }
      return faqs;
    } catch (error) {
       res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get faq by id' })
  @Get(':id')
  async findOne(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    try {
      const faq: any = await this.faqService.findOne(id);
      if (faq.statusCode) {
        res.status(faq.statusCode);
      }
      return faq;
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
