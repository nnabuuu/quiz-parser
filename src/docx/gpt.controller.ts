import { Controller, Post, Body } from '@nestjs/common';
import { GptService } from './gpt.service';

@Controller('gpt')
export class GptController {
    constructor(private readonly gptService: GptService) {}

    @Post('extract-quiz')
    async extractQuiz(@Body() body: { paragraphs: { paragraph: string; highlighted: { text: string; color: string }[] }[] }) {
        return this.gptService.extractQuizItems(body.paragraphs);
    }
}
