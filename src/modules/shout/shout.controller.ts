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
} from '@nestjs/common';
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
import { CreateCommentDto } from './dto/create-comment.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('shout')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shout')
export class ShoutController {
  constructor(private readonly shoutService: ShoutService) {}

  @ApiOperation({ summary: 'Create a new shout' })
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'images', maxCount: 5 },
      { name: 'audio', maxCount: 1 },
    ]),
  )
  createPost(
    @GetUser() user,
    @Body() createShoutDto: CreateShoutDto,
    @UploadedFiles()
    files: { images?: Express.Multer.File[]; audio?: Express.Multer.File[] },
  ) {
    const images = files?.images;
    const audio = files?.audio ? files.audio[0] : null;
    return this.shoutService.createPost(
      user.userId,
      createShoutDto,
      images,
      audio,
    );
  }

  @ApiOperation({ summary: 'Get all shouts with pagination' })
  @Get()
  getAllPosts(
    @GetUser() user,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.shoutService.getAllPosts(user.userId, +page, +limit);
  }

  @ApiOperation({ summary: 'Get profile and shouts of a specific user' })
  @Get('user/:userId')
  getUserProfileAndPosts(
    @GetUser() user,
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.shoutService.getUserProfileAndPosts(
      userId,
      user.userId,
      +page,
      +limit,
    );
  }

  @ApiOperation({ summary: 'Get a shout by ID' })
  @Get(':id')
  getPostById(@GetUser() user, @Param('id') id: string) {
    return this.shoutService.getPostById(id, user.userId);
  }

  @ApiOperation({ summary: 'Update a shout by ID' })
  @Patch(':id')
  updatePost(
    @GetUser() user,
    @Param('id') id: string,
    @Body() updateShoutDto: UpdateShoutDto,
  ) {
    return this.shoutService.updatePost(id, user.userId, updateShoutDto);
  }

  @ApiOperation({ summary: 'Delete a shout by ID' })
  @Delete(':id')
  deletePost(@GetUser() user, @Param('id') id: string) {
    return this.shoutService.deletePost(id, user.userId);
  }

  @ApiOperation({ summary: 'Like a shout' })
  @Post(':id/like')
  like(@GetUser() user, @Param('id') id: string) {
    return this.shoutService.like(id, user.userId);
  }

  @ApiOperation({ summary: 'Unlike a shout' })
  @Delete(':id/like')
  unlike(@GetUser() user, @Param('id') id: string) {
    return this.shoutService.unlike(id, user.userId);
  }

  @ApiOperation({ summary: 'Comment on a shout' })
  @Post(':id/comment')
  comment(
    @GetUser() user,
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return this.shoutService.comment(id, user.userId, createCommentDto);
  }

  @ApiOperation({ summary: 'Get comments for a shout' })
  @Get(':id/comment')
  getComments(
    @GetUser() user,
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.shoutService.getComments(id, +page, +limit);
  }

  @ApiOperation({ summary: 'Share a shout' })
  @Post(':id/share')
  share(
    @Req() req,
    @Param('id') id: string,
    @Body() createShoutDto: CreateShoutDto,
  ) {
    return this.shoutService.share(id, req.user.userId, createShoutDto);
  }

  @ApiOperation({ summary: 'report a shout' })
  @Post(':id/report')
  report(@GetUser() user, @Param('id') id: string, @Body() body) {
    return this.shoutService.report(id, user.userId, body.reason);
  }
}
