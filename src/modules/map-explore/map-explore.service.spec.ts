import { Test, TestingModule } from '@nestjs/testing';
import { MapExploreService } from './map-explore.service';

describe('MapExploreService', () => {
  let service: MapExploreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MapExploreService],
    }).compile();

    service = module.get<MapExploreService>(MapExploreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
