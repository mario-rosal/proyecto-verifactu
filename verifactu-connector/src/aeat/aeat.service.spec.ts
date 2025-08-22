import { Test, TestingModule } from '@nestjs/testing';
import { AeatService } from './aeat.service';

describe('AeatService', () => {
  let service: AeatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AeatService],
    }).compile();

    service = module.get<AeatService>(AeatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
