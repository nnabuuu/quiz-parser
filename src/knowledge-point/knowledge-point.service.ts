// src/knowledge-point/knowledge-point.service.ts
import { Injectable, Logger} from '@nestjs/common';
import { KnowledgePointGPTService } from './knowledge-point-gpt.service';
import { KnowledgePointEmbeddingService} from './knowledge-point-embedding.service';
import {KnowledgePoint, KnowledgePointStorage} from './knowledge-point.storage';
import {QuizItem} from "../docx/gpt.service";

@Injectable()
export class KnowledgePointService {

    private readonly logger = new Logger(KnowledgePointService.name);

    constructor(
        private readonly gpt: KnowledgePointGPTService,
        private readonly embedding: KnowledgePointEmbeddingService,
        private readonly storage: KnowledgePointStorage
    ) {}

    async matchKnowledgePointFromQuiz(quiz: QuizItem): Promise<{matched: KnowledgePoint | null, keywords: string[], country: string, dynasty: string, candidates: {sub: string, candidates: KnowledgePoint[]}[]}> {

        let inputQuizString = `Question: ${quiz.question}`;
        if(quiz.options) {
            inputQuizString += ` Options: ${quiz.options}`;
        }
        if(quiz.answer) {
            inputQuizString += ` Answer: ${quiz.answer}`;
        }

        this.logger.log(`正在处理quiz: ${JSON.stringify(quiz)}`);
        this.logger.log(`提取出的inputQuizString: ${inputQuizString}`)

        // 步骤 1：提取关键词
        const {keywords, country, dynasty} = await this.gpt.extractKeywordsFromQuiz(inputQuizString);
        if (keywords.length === 0) return null;

        // 步骤 2：将关键词拼成一段用于 embedding
        const searchText = `${country}-${dynasty}-${keywords.join('；')}`;
        const inputEmbedding = await this.embedding.getEmbedding(searchText);

        const units = this.storage.getAllUnits();

        // 步骤 3：过滤unit
        const unitFilter = await this.gpt.suggestUnitsByCountryAndDynasty(inputQuizString, units);

        this.logger.log(JSON.stringify(unitFilter));

        // 步骤 4：匹配 top 5 子目
        const topSubMatches = this.embedding.getTopMatches(inputEmbedding, unitFilter, 5);

        const subGroups = topSubMatches.map((match) => ({
            sub: match.sub,
            candidates: match.knowledgePoints,
        }));

        this.logger.log(JSON.stringify(subGroups));

        // 步骤 5：使用 GPT 从 topN 子目中选知识点

        const selectedId = await this.gpt.disambiguateTopicFromCandidates(
            inputQuizString,
            subGroups,
        );

        const found = subGroups.flatMap(g => g.candidates).find(kp => kp.id === selectedId);
        return {matched: found ?? null, keywords, country, dynasty, candidates: subGroups};
    }
}
