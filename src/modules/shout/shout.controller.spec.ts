import { Test, TestingModule } from '@nestjs/testing';
import { ShoutController } from './shout.controller';
import { ShoutService } from './shout.service';

describe('ShoutController', () => {
  let controller: ShoutController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShoutController],
      providers: [ShoutService],
    }).compile();

    controller = module.get<ShoutController>(ShoutController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
