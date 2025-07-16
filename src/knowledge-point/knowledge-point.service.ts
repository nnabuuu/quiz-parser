// src/knowledge-point/knowledge-point.service.ts
import { Injectable } from '@nestjs/common';
import { KnowledgePointGPTService } from './knowledge-point-gpt.service';
import { KnowledgePointEmbeddingService } from './knowledge-point-embedding.service';
import { KnowledgePointStorage, KnowledgePoint } from './knowledge-point.storage';
import {QuizItem} from "../docx/gpt.service";

@Injectable()
export class KnowledgePointService {
    constructor(
        private readonly gpt: KnowledgePointGPTService,
        private readonly embedding: KnowledgePointEmbeddingService,
        private readonly storage: KnowledgePointStorage,
    ) {}

    async matchKnowledgePointFromQuiz(quiz: QuizItem): Promise<KnowledgePoint | null> {

        let inputQuizString = `Question: ${quiz.question}`;
        if(quiz.options) {
            inputQuizString += ` Options: ${quiz.options}`;
        }
        if(quiz.answer) {
            inputQuizString += ` Answer: ${quiz.answer}`;
        }

        // 步骤 1：提取关键词
        const keywords = await this.gpt.extractKeywordsFromQuiz(inputQuizString);
        if (keywords.length === 0) return null;

        // 步骤 2：将关键词拼成一段用于 embedding
        const searchText = keywords.join('；');
        const inputEmbedding = await this.embedding.getEmbedding(searchText);

        // 步骤 3：匹配 top 3 子目
        const topSubMatches = this.embedding.getTopMatches(inputEmbedding, 3);

        // 步骤 4：使用 GPT 从 topN 子目中选知识点
        for (const match of topSubMatches) {
            const selectedId = await this.gpt.disambiguateTopicFromCandidates(
                quiz.question,
                match.sub,
                match.knowledgePoints,
            );
            const found = match.knowledgePoints.find((kp) => kp.id === selectedId);
            if (found) return found;
        }

        return null;
    }
}
