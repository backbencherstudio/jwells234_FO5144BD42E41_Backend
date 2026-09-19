import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Response } from 'express';

@ApiBearerAuth()
@ApiTags('Conversation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat/conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @ApiOperation({ summary: 'Create conversation' })
  @Post()
  async create(
    @Body() createConversationDto: CreateConversationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response: any = await this.conversationService.create(
        createConversationDto,
      );
      if (response.statusCode) {
        res.status(response.statusCode);
      }
      return response;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  // @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all conversations' })
  @Get()
  async findAll(@Res({ passthrough: true }) res: Response) {
    try {
      const response: any = await this.conversationService.findAll();
      if (response.statusCode) {
        res.status(response.statusCode);
      }
      return response;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get a conversation by id' })
  @Get(':id')
  async findOne(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    try {
      const response: any = await this.conversationService.findOne(id);
      if (response.statusCode) {
        res.status(response.statusCode);
      }
      return response;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a conversation' })
  @Delete(':id')
  async remove(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    try {
      const response: any = await this.conversationService.remove(id);
      if (response.statusCode) {
        res.status(response.statusCode);
      }
      return response;
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
