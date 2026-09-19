import { Test, TestingModule } from '@nestjs/testing';
import { MapExploreController } from './map-explore.controller';
import { MapExploreService } from './map-explore.service';

describe('MapExploreController', () => {
  let controller: MapExploreController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MapExploreController],
      providers: [MapExploreService],
    }).compile();

    controller = module.get<MapExploreController>(MapExploreController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
