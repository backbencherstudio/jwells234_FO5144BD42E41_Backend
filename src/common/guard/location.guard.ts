import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { LocationService } from '../lib/LocationService';

@Injectable()
export class LocationGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    let latitude = request.headers['x-latitude'];
    let longitude = request.headers['x-longitude'];

    // Fallback to body if headers are missing
    if (!latitude || !longitude) {
      if (request.body && (request.body.latitude || request.body.latitude === 0) && (request.body.longitude || request.body.longitude === 0)) {
        latitude = request.body.latitude;
        longitude = request.body.longitude;
      }
    }

    if (latitude === undefined || longitude === undefined) {
      throw new BadRequestException(
        'Location coordinates (latitude, longitude) are required in headers (x-latitude, x-longitude) or body.',
      );
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      throw new BadRequestException('Invalid location coordinates.');
    }

    const isAllowed = await LocationService.isLocationAllowed(lat, lng);

    if (!isAllowed) {
      throw new ForbiddenException('Access restricted to Bangladesh and Nigeria only.');
    }

    return true;
  }
}
