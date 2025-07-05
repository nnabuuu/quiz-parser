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
        const prompt = `你是一个教育出题助手。你的任务是从提供的段落中提取题目，并严格基于高亮部分生成题干和答案。请遵守以下规则：

1. **只能使用输入中的内容（包括高亮和原文）**，绝不能添加或虚构任何新的内容、选项或表述。
2. **高亮的内容为答案或重要知识点**，请据此推断题型和正确答案。
3. 不要创造新的选项。仅在原文中明确列出可供选择的选项时，才可生成选择题。
4. 若原文中未明确列出多个选项，但包含某个高亮词汇，请将其作为“填空题”处理。
5. 若原文中出现大段答案结果，请将其作为“主观题”处理
6. 如果题干/答案以数字或编号开头（如“1.”、“①”等），请将这些部分从题干中去除。
7. 返回的 JSON 格式必须完全符合以下结构：

每道题返回：
- type: "single-choice"、"multiple-choice"、"fill-in-the-blank"、"subjective"、"other"
- question: 题干
- options: 可选，仅适用于选择题
- answer: 正确答案（"single-choice" 和 "multiple-choice" 为索引数组，"fill-in-the-blank" 为字符串数组，"subjective" 和 "other" 为字符串）

示例：
{
  "items": [
    {
      "type": "fill-in-the-blank",
      "question": "春秋时期，中原各国自称______。",
      "answer": ["华夏"]
    },
    {
      "type": "subjective",
      "question": "简述儒家代表人物孟子的核心思想。",
      "answer": "仁政"
    }
  ]
}

请根据下方输入提取题目并返回严格符合上述格式的 JSON。不要包含多余解释、注释或非结构化内容。
`;

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
