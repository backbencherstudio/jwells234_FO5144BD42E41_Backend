import axios from 'axios';
import appConfig from '../../config/app.config';

export class LocationService {
  static async isLocationInBangladesh(lat: number, lng: number): Promise<boolean> {
    const apiKey = appConfig().app.googleMapsApiKey;
    
    if (!apiKey) {
      console.warn('Google Maps API Key is missing.');
      // If strict mode is required, return false. 
      // However, without a key, we can't verify. 
      // Returning false ensures security but might block valid users if config is missing.
      return false; 
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
      const response = await axios.get(url);

      if (response.data.status !== 'OK') {
        console.error('Google Maps API error:', response.data.status, response.data.error_message);
        return false;
      }

      const results = response.data.results;
      for (const result of results) {
        for (const component of result.address_components) {
          if (component.types.includes('country')) {
            if (component.long_name === 'Bangladesh' || component.short_name === 'BD') {
              return true;
            }
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking location:', error);
      return false;
    }
  }
}
