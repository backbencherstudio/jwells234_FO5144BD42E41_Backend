import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageGateway } from './message.gateway';
import { Request, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@ApiTags('Message')
@UseGuards(JwtAuthGuard)
@Controller('chat/message')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly messageGateway: MessageGateway,
  ) {}

  @ApiOperation({ summary: 'Send message' })
  @Post()
  async create(
    @Req() req: Request,
    @Body() createMessageDto: CreateMessageDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const user_id = req.user.userId;
      const message: any = await this.messageService.create(
        user_id,
        createMessageDto,
      );
      if (message.success) {
        const messageData = {
          message: {
            id: message.data.id,
            message_id: message.data.id,
            body_text: message.data.message,
            from: message.data.sender_id,
            conversation_id: message.data.conversation_id,
            created_at: message.data.created_at,
          },
        };
        this.messageGateway.server
          .to(message.data.conversation_id)
          .emit('message', {
            from: message.data.sender_id,
            data: messageData,
          });
        
        if (message.statusCode) {
          res.status(message.statusCode);
        }
        return {
          success: message.success,
          statusCode: message.statusCode || 201,
          message: message.message,
        };
      } else {
        if (message.statusCode) {
          res.status(message.statusCode);
        }
        return {
          success: message.success,
          statusCode: message.statusCode,
          message: message.message,
        };
      }
    } catch (error) {
       res.status(500);
       return {
         success: false,
         statusCode: 500,
         message: error.message
       }
    }
  }

  @ApiOperation({ summary: 'Get all messages' })
  @Get()
  async findAll(
    @Req() req: Request,
    @Query()
    query: { conversation_id: string; limit?: number; cursor?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user_id = req.user.userId;
    const conversation_id = query.conversation_id as string;
    const limit = Number(query.limit);
    const cursor = query.cursor as string;
    try {
      const messages: any = await this.messageService.findAll({
        user_id,
        conversation_id,
        limit,
        cursor,
      });
      if (messages.statusCode) {
        res.status(messages.statusCode);
      }
      return messages;
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
