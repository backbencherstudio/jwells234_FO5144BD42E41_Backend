import { Test, TestingModule } from '@nestjs/testing';
import { ShoutService } from './shout.service';

describe('ShoutService', () => {
  let service: ShoutService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShoutService],
    }).compile();

    service = module.get<ShoutService>(ShoutService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
