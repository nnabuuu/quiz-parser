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

        const prompt = `你是一位历史教育专家，负责从中学历史选择题中提取/总结关键词，用于后续匹配标准教学知识点。

请根据提供的试题内容和正确选项，从题目中提炼 1～5 个最能表达该题核心考点的关键词或短语。

提取原则如下：

1. **优先体现正确答案所代表的核心历史概念或事件**，如“光荣革命”“夏朝”“农耕文明”等；
2. 同时结合题干中提供的背景、描述、逻辑判断等线索，提炼/总结能够准确描述题意的关键词；
3. 避免提取无意义的功能性词（如“选择”“描述”），也不要简单照抄选项；`;

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
        subGroups: { sub: string; candidates: KnowledgePoint[] }[],
    ): Promise<string> {
        const schema = {
            name: 'disambiguate_topic',
            description: '从多个子目的候选知识点中选择最相关的一项',
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

        const data = {
            quiz: quizText,
            groups: subGroups.map((group) => ({
                sub: group.sub,
                candidates: group.candidates.map(({ id, topic }) => ({ id, topic })),
            })),
        };

        const prompt = `你是一位中学历史命题与教学专家。

请根据下列选择题内容、各子目分类和提供的多个候选知识点，选择其中最贴切、最能准确覆盖该题目考查核心的知识点，并返回其 ID。

你应优先参考：
1. 试题的设问重点与叙述语境；
2. 标准答案所指向的概念；
3. 子目的语义分类；
4. 候选知识点之间的差异性。

最终请只返回一个知识点的 ID，对应最贴合的知识点。`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: prompt + '\n\n' + JSON.stringify(data, null, 2),
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