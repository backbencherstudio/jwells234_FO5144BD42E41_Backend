import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import { MapExploreService } from './map-explore.service';
import { SaveLocationDto } from './dto/save-location.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { SubscriptionGuard } from '../../common/guard/subscription.guard';
import { Response } from 'express';

@ApiTags('Map Explore')
@ApiBearerAuth()
// @UseGuards(JwtAuthGuard, SubscriptionGuard)
@UseGuards(JwtAuthGuard)
@Controller('map-explore')
export class MapExploreController {
  constructor(private readonly mapExploreService: MapExploreService) {}

  @ApiOperation({ summary: 'Search for places' })
  @Get('search')
  async searchPlaces(
    @Query('query') query: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response = await this.mapExploreService.searchPlaces(query);
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

  @ApiOperation({ summary: 'Save a location' })
  @Post('save')
  async saveLocation(
    @GetUser() user,
    @Body() saveLocationDto: SaveLocationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response = await this.mapExploreService.saveLocation(
        user.userId,
        saveLocationDto,
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

  @ApiOperation({ summary: 'Get saved locations' })
  @Get('saved')
  async getSavedLocations(
    @GetUser() user,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response = await this.mapExploreService.getSavedLocations(
        user.userId,
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

  @ApiOperation({ summary: 'Delete a saved location' })
  @Delete('saved/:id')
  async deleteLocation(
    @GetUser() user,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response = await this.mapExploreService.deleteLocation(
        user.userId,
        id,
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
}
