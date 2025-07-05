import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface ParagraphBlock {
    paragraph: string;
    highlighted: { text: string; color: string }[];
}

export interface QuizItem {
    type: 'single-choice' | 'multiple-choice' | 'fill-in-the-blank' | 'subjective' | 'other';
    question: string;
    options?: string[];
    answer?: string | string[] | number[];
}

@Injectable()
export class GptService {
    private readonly openai: OpenAI;

    constructor(private readonly configService: ConfigService) {
        this.openai = new OpenAI({
            apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        });
    }

    async extractQuizItems(paragraphs: ParagraphBlock[]): Promise<QuizItem[]> {
        const prompt = `你是一个教育出题助手。以下是一组段落（包括题干、选项和高亮信息）。请从中提取题目，并判断题型。
        
        注意：请只从输入中提取，而不要添加输入中不存在的内容，高亮标记为正确答案。

每道题返回：
- type: 题型，可选值为 "single-choice"、"multiple-choice"、"fill-in-the-blank"、"subjective"、"other"
- question: 题干（注意如果输入的题干字符串以序号开头，则应该去除这些序号因为它们不属于题干的一部分）
- options: 可选，仅适用于选择题
- answer: 正确答案（single-choice、multiple-choice为索引数组，fill-in-the-blank为string数组，subjective、other为 string）

请严格按照以下 schema 返回 JSON，结构为一个包含 items 字段的对象。`;

        const schema = {
            name: 'extract_quiz_items',
            description: '从段落中提取多种类型的题目',
            strict: true,
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                type: {
                                    type: 'string',
                                    enum: ['single-choice', 'multiple-choice', 'fill-in-the-blank', 'subjective', 'other'],
                                },
                                question: { type: 'string' },
                                options: {
                                    type: 'array',
                                    items: { type: 'string' },
                                },
                                answer: {
                                    anyOf: [
                                        { type: 'string' },
                                        { type: 'array', items: { type: 'string' } },
                                        { type: 'array', items: { type: 'number' } },
                                    ],
                                },
                            },
                            required: ['type', 'question', 'options', 'answer'],
                        },
                    },
                },
                required: ['items'],
            },
        } as const;

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

        const content = response.choices[0]?.message?.content;
        try {
            const parsed = JSON.parse(content ?? '{}');
            return parsed.items ?? [];
        } catch (error) {
            return [{ type: 'other', question: 'GPT 返回解析失败', answer: content }] as QuizItem[];
        }
    }
}
