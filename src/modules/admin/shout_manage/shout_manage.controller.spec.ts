import { Test, TestingModule } from '@nestjs/testing';
import { ShoutManageController } from './shout_manage.controller';
import { ShoutManageService } from './shout_manage.service';

describe('ShoutManageController', () => {
  let controller: ShoutManageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShoutManageController],
      providers: [ShoutManageService],
    }).compile();

    controller = module.get<ShoutManageController>(ShoutManageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
