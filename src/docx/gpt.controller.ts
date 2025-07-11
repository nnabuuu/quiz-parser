import { Controller, Post, Body } from '@nestjs/common';
import { GptService, QuizItem } from './gpt.service';

@Controller('gpt')
export class GptController {
    constructor(private readonly gptService: GptService) {}

    @Post('extract-quiz')
    async extractQuiz(@Body() body: { paragraphs: { paragraph: string; highlighted: { text: string; color: string }[] }[] }) {
        return this.gptService.extractQuizItems(body.paragraphs);
    }

    @Post('polish-quiz')
    async polishQuiz(@Body() body: { item: QuizItem }) {
        return this.gptService.polishQuizItem(body.item);
    }

    @Post('change-quiz-type')
    async changeQuizType(@Body() body: { item: QuizItem; newType: QuizItem['type'] }) {
        return this.gptService.changeQuizItemType(body.item, body.newType);
    }
}
