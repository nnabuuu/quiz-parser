// src/knowledge-point/knowledge-point-gpt.service.ts
import {Injectable, Logger} from '@nestjs/common';
import OpenAI from 'openai';
import {ConfigService} from "@nestjs/config";
import {KnowledgePoint} from "./knowledge-point.storage";

@Injectable()
export class KnowledgePointGPTService {
    private readonly openai: OpenAI;
    private readonly logger = new Logger(KnowledgePointGPTService.name);

    constructor(private readonly configService: ConfigService) {
        this.openai = new OpenAI({
            apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        });
    }

    async extractKeywordsFromQuiz(quizText: string): Promise<{keywords: string[], country: string, dynasty: string}> {
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
                    country: {
                        type: 'string',
                        description: '题目涉及的国家',
                    },
                    dynasty: {
                        type: 'string',
                        description: '题目涉及的朝代，如果国家不是中国则填：无'
                    }
                },
                required: ['keywords', 'country', 'dynasty'],
                additionalProperties: false,
            },
        };

        const prompt = `你是一位历史教育专家，负责从中学历史选择题中提取/总结关键词、国家、朝代，用于后续匹配标准教学知识点。

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
            return JSON.parse(response.choices[0].message?.content);
        } catch {
            return {keywords: [], country: '未知', dynasty: '无'};
        }
    }

    async disambiguateTopicFromCandidates(
        quizText: string,
        subGroups: { sub: string; candidates: KnowledgePoint[] }[],
    ): Promise<string> {

        this.logger.log(`筛选知识点：
        ${quizText}
        Candidates:
        ${JSON.stringify(subGroups)}
        `);

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

        const prompt = `你是一位中学历史命题与教学专家，擅长分析历史选择题背后的考查意图。

请根据下列选择题内容、子目分类和提供的多个候选知识点，选择其中最贴切、最能准确覆盖该题目考查核心的知识点，并返回其 ID。

在判断知识点匹配前，请先分析这道题的“考查重点”属于以下哪类之一（但不限于）：
- 思想主张（如某学派的理论、人物的政治观念）
- 制度变迁（如郡县制、世袭制、科举、改革措施）
- 历史事件（如某场战争、革命、运动、条约）
- 社会结构或文化特征（如农耕文明、宗教传播）
- 历史背景与因果分析（如某事件发生的根本原因或历史影响）

你应根据题干的**设问动词、叙述语境、答案信息**来判断其真正意图，并据此从候选知识点中做出最佳匹配。

在判断时请依次参考：
1. 题干的措辞是否指向主张、制度、事件等不同类型内容；
2. 答案所指向的核心概念，是否属于特定主题范畴；
3. 子目的分类语义；
4. 候选知识点之间的细微差别，避免宽泛或表面匹配。

最终只返回一个最贴合的知识点的 ID。`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: prompt + '\n\n' + JSON.stringify(data, null, 2),
                },
            ],
            temperature: 0,
            response_format: {
                type: 'json_schema',
                json_schema: schema,
            },
        });

        const raw = response.choices[0].message?.content;

        this.logger.log(`筛选结果： ${raw}`);

        try {
            const parsed = JSON.parse(raw || '');
            return parsed.selectedId ?? '';
        } catch {
            return '';
        }
    }
}