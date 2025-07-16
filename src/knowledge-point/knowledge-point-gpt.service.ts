// src/knowledge-point/knowledge-point-gpt.service.ts
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import {ConfigService} from "@nestjs/config";
import {KnowledgePoint, KnowledgePointStorage} from "./knowledge-point.storage";

@Injectable()
export class KnowledgePointGPTService {
    private readonly openai: OpenAI;

    constructor(private readonly configService: ConfigService,
                private readonly knowledgePointStorage: KnowledgePointStorage) {
        this.openai = new OpenAI({
            apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        });
    }

    async extractKeywordsFromQuiz(quizText: string): Promise<string[]> {
        const schema = {
            name: 'extract_keywords',
            description: '从试题中提取关键词列表',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    keywords: {
                        type: 'array',
                        description: '关键词数组，用于教学知识点匹配',
                        items: { type: 'string' },
                        minItems: 1,
                        maxItems: 5,
                    },
                },
                required: ['keywords'],
                additionalProperties: false,
            },
        };

        const prompt = `你是一个教育专家，请从以下试题中提取出 1 - 5 个关键词，用于匹配相关教学知识点。请返回关键词数组：`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: prompt + '\n\n' + quizText,
                },
            ],
            response_format: {
                type: 'json_schema',
                json_schema: schema,
            },
        });

        try {
            const result = JSON.parse(response.choices[0].message?.content || '{}');
            return result.keywords || [];
        } catch {
            return [];
        }
    }

    async disambiguateTopicFromCandidates(
        quizText: string,
        sub: string,
        candidates: KnowledgePoint[],
    ): Promise<string> {
        const schema = {
            name: 'disambiguate_topic',
            description: '从候选知识点中选择最相关的一项',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    selectedId: {
                        type: 'string',
                        description: '最终选择的知识点 ID',
                    },
                },
                required: ['selectedId'],
                additionalProperties: false,
            },
        };

        const paragraphs = {
            quiz: quizText,
            sub,
            candidates: candidates.map(({ id, topic }) => ({ id, topic })),
        };

        const prompt = `你是一个教育专家，请根据以下试题内容和子目，从候选知识点中选出最匹配的一项，并返回其 ID。`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: prompt + '\n\n' + JSON.stringify(paragraphs, null, 2),
                },
            ],
            response_format: {
                type: 'json_schema',
                json_schema: schema,
            },
        });

        const raw = response.choices[0].message?.content;
        try {
            const parsed = JSON.parse(raw || '');
            return parsed.selectedId ?? '';
        } catch {
            return '';
        }
    }
}