import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ShoutService } from './shout.service';
import { CreateShoutDto } from './dto/create-shout.dto';
import { UpdateShoutDto } from './dto/update-shout.dto';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CreateCommentDto } from './dto/create-comment.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { SubscriptionGuard } from 'src/common/guard/subscription.guard';

@ApiTags('shout')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('shout')
export class ShoutController {
  constructor(private readonly shoutService: ShoutService) {}

  @ApiOperation({ summary: 'Create a new shout' })
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 5 },
        { name: 'audio', maxCount: 1 },
        { name: 'video', maxCount: 3 },
      ],
      {
        storage: memoryStorage(),
      },
    ),
  )
  async createPost(
    @GetUser() user,
    @Body() createShoutDto: CreateShoutDto,
    @UploadedFiles()
    files: {
      images?: Express.Multer.File[];
      audio?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const images = files?.images;
      const audio = files?.audio ? files.audio[0] : null;
      const videos = files?.video;
      const result = await this.shoutService.createPost(
        user.userId,
        createShoutDto,
        images,
        audio,
        videos,
      );
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      // Log the underlying error so we can diagnose 500s.
      console.error('Failed to create shout:', error);
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: error?.message || 'Failed to create shout',
      };
    }
  }

  @ApiOperation({ summary: 'Get all shouts with pagination' })
  @Get()
  async getAllPosts(
    @GetUser() user,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.getAllPosts(
        user.userId,
        +page,
        +limit,
      );
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to fetch shouts',
      };
    }
  }

  @ApiOperation({ summary: 'Get profile and shouts of a specific user' })
  @Get('user/:userId')
  async getUserProfileAndPosts(
    @GetUser() user,
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.getUserProfileAndPosts(
        userId,
        user.userId,
        +page,
        +limit,
      );
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to fetch user profile and posts',
      };
    }
  }

  @ApiOperation({ summary: 'Get a shout by ID' })
  @Get(':id')
  async getPostById(
    @GetUser() user,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.getPostById(id, user.userId);
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to fetch shout',
      };
    }
  }

  @ApiOperation({ summary: 'Update a shout by ID' })
  @Patch(':id')
  async updatePost(
    @GetUser() user,
    @Param('id') id: string,
    @Body() updateShoutDto: UpdateShoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.updatePost(
        id,
        user.userId,
        updateShoutDto,
      );
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to update shout',
      };
    }
  }

  @ApiOperation({ summary: 'Delete a shout by ID' })
  @Delete(':id')
  async deletePost(
    @GetUser() user,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.deletePost(id, user.userId);
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to delete shout',
      };
    }
  }

  @ApiOperation({ summary: 'Like a shout' })
  @Post(':id/like')
  async like(
    @GetUser() user,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.like(id, user.userId);
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to like shout',
      };
    }
  }

  @ApiOperation({ summary: 'Unlike a shout' })
  @Delete(':id/like')
  async unlike(
    @GetUser() user,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.unlike(id, user.userId);
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to unlike shout',
      };
    }
  }

  @ApiOperation({ summary: 'Comment on a shout' })
  @Post(':id/comment')
  async comment(
    @GetUser() user,
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.comment(
        id,
        user.userId,
        createCommentDto,
      );
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to comment on shout',
      };
    }
  }


  @ApiOperation({ summary: 'Get top-level comments for a shout' })
  @Get(':id/comment')
  async getComments(
    @GetUser() user,
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.getComments(
        id,
        user.userId,
        +page,
        +limit,
      );
      if (result.statusCode) res.status(result.statusCode);
      return result;
    } catch (error) {
      console.error(error);
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to fetch comments',
      };
    }
  }

  @ApiOperation({ summary: 'Get replies of a specific comment' })
  @Get('comment/:commentId/replies')
  async getCommentReplies(
    @GetUser() user,
    @Param('commentId') commentId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.getCommentReplies(
        commentId,
        user.userId,
        +page,
        +limit,
      );
      if (result.statusCode) res.status(result.statusCode);
      return result;
    } catch (error) {
      console.error(error);
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to fetch comment replies',
      };
    }
  }

  @ApiOperation({ summary: 'like a shout comment' })
  @Post(':shoutId/comment/:commentId/like')
  async likeComment(
    @GetUser() user,
    @Param('shoutId') shoutId: string,
    @Param('commentId') commentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.likeComment(
        commentId,
        user.userId,
      );
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to like comment',
      };
    }
  }

  @ApiOperation({ summary: 'unlike a shout comment' })
  @Delete(':shoutId/comment/:commentId/unlike')
  async unlikeComment(
    @GetUser() user,
    @Param('shoutId') shoutId: string,
    @Param('commentId') commentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.unlikeComment(
        commentId,
        user.userId,
      );
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to unlike comment',
      };
    }
  }

  @ApiOperation({ summary: 'Delete a comment from a shout' })
  @Delete(':shoutId/comment/:commentId')
  async deleteComment(
    @GetUser() user,
    @Param('shoutId') shoutId: string,
    @Param('commentId') commentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.deleteComment(
        commentId,
        user.userId,
      );
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to delete comment',
      };
    }
  }

  @ApiOperation({ summary: 'Share a shout' })
  @Post(':id/share')
  async share(
    @Req() req,
    @Param('id') id: string,
    @Body() createShoutDto: CreateShoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.share(
        id,
        req.user.userId,
        createShoutDto,
      );
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to share shout',
      };
    }
  }

  @ApiOperation({ summary: 'report a shout' })
  @Post(':id/report')
  async report(
    @GetUser() user,
    @Param('id') id: string,
    @Body() body,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.shoutService.report(
        id,
        user.userId,
        body.reason,
      );
      if (result.statusCode) {
        res.status(result.statusCode);
      }
      return result;
    } catch (error) {
      res.status(500);
      return {
        success: false,
        statusCode: 500,
        message: 'Failed to report shout',
      };
    }
  }
}
