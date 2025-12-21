import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MapExploreService } from './map-explore.service';
import { SaveLocationDto } from './dto/save-location.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('Map Explore')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('map-explore')
export class MapExploreController {
  constructor(private readonly mapExploreService: MapExploreService) {}

  @ApiOperation({ summary: 'Search for places' })
  @Get('search')
  searchPlaces(@Query('query') query: string) {
    return this.mapExploreService.searchPlaces(query);
  }

  @ApiOperation({ summary: 'Save a location' })
  @Post('save')
  saveLocation(@GetUser() user, @Body() saveLocationDto: SaveLocationDto) {
    return this.mapExploreService.saveLocation(user.userId, saveLocationDto);
  }

  @ApiOperation({ summary: 'Get saved locations' })
  @Get('saved')
  getSavedLocations(@GetUser() user) {
    return this.mapExploreService.getSavedLocations(user.userId);
  }

  @ApiOperation({ summary: 'Delete a saved location' })
  @Delete('saved/:id')
  deleteLocation(@GetUser() user, @Param('id') id: string) {
    return this.mapExploreService.deleteLocation(user.userId, id);
  }
}
