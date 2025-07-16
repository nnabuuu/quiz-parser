import {Body, Controller, Post} from '@nestjs/common';
import {QuizItem} from "../docx/gpt.service";
import {KnowledgePointService} from "./knowledge-point.service";

@Controller('knowledge-point')
export class KnowledgePointController {
    constructor(private readonly knowledgePointService: KnowledgePointService) {}

    @Post('match')
    async matchQuiz(@Body() quiz: QuizItem) {
        const result = await this.knowledgePointService.matchKnowledgePointFromQuiz(quiz);
        return { matched: result };
    }
}
