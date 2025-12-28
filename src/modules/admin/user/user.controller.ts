import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';

@ApiBearerAuth()
@ApiTags('User')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiResponse({ description: 'Create a user' })
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    try {
      const user = await this.userService.create(createUserDto);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiResponse({ description: 'Get all users' })
  @Get()
  async getAllUsers(
    @Query() query: { q?: string; type?: string; approved?: string },
  ) {
    try {
      const q = query.q;
      const type = query.type;
      const approved = query.approved;

      const users = await this.userService.getAllUsers({ q, type, approved });
      return users;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiResponse({ description: 'Warn a user by id' })
  @Post(':id/warn')
  async warnUser(@Param('id') id: string) {
    try {
      const user = await this.userService.warnUser(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiResponse({ description: 'Ban a user by id' })
  @Post(':id/ban')
  async banUser(@Param('id') id: string) {
    try {
      const user = await this.userService.banUser(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // approve user
  // @Roles(Role.ADMIN)
  // @ApiResponse({ description: 'Approve a user' })
  // @Post(':id/approve')
  // async approve(@Param('id') id: string) {
  //   try {
  //     const user = await this.userService.approve(id);
  //     return user;
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  // // reject user
  // @Roles(Role.ADMIN)
  // @ApiResponse({ description: 'Reject a user' })
  // @Post(':id/reject')
  // async reject(@Param('id') id: string) {
  //   try {
  //     const user = await this.userService.reject(id);
  //     return user;
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  @ApiResponse({ description: 'Get a user by id' })
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    try {
      const user = await this.userService.getUserById(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiResponse({ description: 'Update a user by id' })
  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    try {
      const user = await this.userService.updateUser(id, updateUserDto);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiResponse({ description: 'Delete a user by id' })
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    try {
      const user = await this.userService.deleteUser(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiResponse({ description: 'Get my profile info' })
  @Get('profile/me')
  async getProfile(@GetUser() user: any) {
    try {
      console.log('User from token:', user);
      const profile = await this.userService.getProfile(user.userId);
      return profile;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
