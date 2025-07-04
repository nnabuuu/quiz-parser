import { Test, TestingModule } from '@nestjs/testing';
import { DocxController } from './docx.controller';

describe('DocxController', () => {
  let controller: DocxController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocxController],
    }).compile();

    controller = module.get<DocxController>(DocxController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
