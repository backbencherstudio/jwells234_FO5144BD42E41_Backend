import { config } from 'dotenv';
config(); // Load .env

import { LocationService } from './src/common/lib/LocationService';

async function test() {
  console.log('Testing LocationService...');

  // Dhaka, Bangladesh (Should be TRUE)
  const dhakaLat = 23.8103;
  const dhakaLng = 90.4125;
  console.log(`Checking Dhaka (${dhakaLat}, ${dhakaLng})...`);
  const isDhakaAllowed = await LocationService.isLocationAllowed(dhakaLat, dhakaLng);
  console.log(`Is Dhaka allowed? ${isDhakaAllowed}`);

  // Lagos, Nigeria (Should be TRUE)
  const lagosLat = 6.5244;
  const lagosLng = 3.3792;
  console.log(`Checking Lagos (${lagosLat}, ${lagosLng})...`);
  const isLagosAllowed = await LocationService.isLocationAllowed(lagosLat, lagosLng);
  console.log(`Is Lagos allowed? ${isLagosAllowed}`);

  // New York, USA (Should be FALSE)
  const nyLat = 40.7128;
  const nyLng = -74.0060;
  console.log(`Checking New York (${nyLat}, ${nyLng})...`);
  const isNyAllowed = await LocationService.isLocationAllowed(nyLat, nyLng);
  console.log(`Is New York allowed? ${isNyAllowed}`);
}

test();
