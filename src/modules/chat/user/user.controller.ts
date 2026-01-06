import { Controller, Get, Res } from '@nestjs/common';
import { UserService } from './user.service';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('User')
@Controller('chat/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(@Res({ passthrough: true }) res: Response) {
    try {
      const users: any = await this.userService.findAll();
      if (users.statusCode) {
        res.status(users.statusCode);
      }
      return users;
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
