import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { GptService } from './gpt.service';

describe('GptService', () => {
  let service: GptService;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'test';
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [GptService],
    }).compile();

    service = module.get<GptService>(GptService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have polishQuizItem function', () => {
    expect(typeof service.polishQuizItem).toBe('function');
  });

  it('should have changeQuizItemType function', () => {
    expect(typeof service.changeQuizItemType).toBe('function');
  });
});
