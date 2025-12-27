import { Test, TestingModule } from '@nestjs/testing';
import { ShoutManageService } from './shout_manage.service';

describe('ShoutManageService', () => {
  let service: ShoutManageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShoutManageService],
    }).compile();

    service = module.get<ShoutManageService>(ShoutManageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
