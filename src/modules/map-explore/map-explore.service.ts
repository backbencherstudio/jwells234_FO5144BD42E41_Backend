import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveLocationDto } from './dto/save-location.dto';
import appConfig from '../../config/app.config';
import axios from 'axios';
import { NotificationService } from '../application/notification/notification.service';

@Injectable()
export class MapExploreService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async searchPlaces(query: string) {
    const apiKey = appConfig().app.googleMapsApiKey;
    if (!apiKey) {
      throw new Error('Google Maps API Key is missing');
    }

    try {
      // Using Places API (New) - Text Search
      // https://places.googleapis.com/v1/places:searchText
      const url = `https://places.googleapis.com/v1/places:searchText`;

      const response = await axios.post(
        url,
        {
          textQuery: query,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'places.displayName,places.formattedAddress,places.location,places.id',
          },
        },
      );

      if (!response.data.places) {
        return {
          success: true,
          data: [],
        };
      }

      return {
        success: true,
        data: response.data.places.map((place) => ({
          name: place.displayName?.text,
          address: place.formattedAddress,
          latitude: place.location?.latitude,
          longitude: place.location?.longitude,
          place_id: place.id,
        })),
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error(
          'Google Places API Error:',
          JSON.stringify(error.response.data, null, 2),
        );
      } else {
        console.error('Error searching places:', error);
      }
      return {
        success: false,
        message: 'Failed to search places',
      };
    }
  }

  async saveLocation(userId: string, saveLocationDto: SaveLocationDto) {
    try {
      if (!userId) {
        throw new NotFoundException('User not found');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      console.log('dto', saveLocationDto);

      let existingLocation;

      if (saveLocationDto.place_id) {
        // If place_id is provided, check by place_id (it's unique and reliable)
        console.log("hit in place id");
        existingLocation = await this.prisma.savedLocation.findFirst({
          where: {
            user_id: userId,
            place_id: saveLocationDto.place_id,
          },
        });
      } else {
        // Fallback to lat/long check if place_id is missing
        console.log("hit in else");
        existingLocation = await this.prisma.savedLocation.findFirst({
          where: {
            user_id: userId,
            latitude: saveLocationDto.latitude,
            longitude: saveLocationDto.longitude,
          },
        });
      }

      console.log('existing locations', existingLocation);
      if (existingLocation) {
        return {
          success: false,
          message: 'Location already saved',
        };
      }

      const savedLocation = await this.prisma.savedLocation.create({
        data: {
          user_id: userId,
          ...saveLocationDto,
        },
      });

      // Create a notification for the user
      try {
        await this.notificationService.createNotification({
          sender_id: userId,
          receiver_id: userId,
          text: `You have successfully saved the location: ${savedLocation.name}`,
          type: 'message',
          entity_id: savedLocation.id,
        });
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
        // Don't fail the request if notification fails
      }

      return {
        success: true,
        message: 'Location saved successfully',
        data: savedLocation,
      };
    } catch (error) {
      console.error('Error saving location:', error);
      return {
        success: false,
        message: 'Failed to save location',
      };
    }
  }

  async getSavedLocations(userId: string) {
    try {
      if (!userId) {
        throw new NotFoundException('User not found');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const locations = await this.prisma.savedLocation.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
      });

      return {
        success: true,
        data: locations,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch saved locations',
      };
    }
  }

  async deleteLocation(userId: string, locationId: string) {
    try {
      if (!userId) {
        throw new NotFoundException('User not found');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const location = await this.prisma.savedLocation.findUnique({
        where: { id: locationId },
      });

      if (!location || location.user_id !== userId) {
        throw new NotFoundException('Location not found or unauthorized');
      }

      await this.prisma.savedLocation.delete({
        where: { id: locationId },
      });

      return {
        success: true,
        message: 'Location deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to delete location',
      };
    }
  }
}
