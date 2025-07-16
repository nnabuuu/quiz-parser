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

    async suggestUnitsByCountryAndDynasty(
        quizText: string,
        units: string[],
    ): Promise<string[]> {
        const schema = {
            name: 'suggest_units',
            description: '根据试题提到的国家和朝代，返回最相关教学单元在原始列表中的索引（从0开始）',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    indexes: {
                        type: 'array',
                        description: '最相关教学单元在原始输入数组中的索引，按相关性降序排列，最多返回3个',
                        items: { type: 'integer' },
                        minItems: 1,
                        maxItems: 3,
                    },
                },
                required: ['indexes'],
                additionalProperties: false,
            },
        };

        const prompt = `你是一位中学历史教学专家。

请根据以下选择题内容，分析其涉及的国家、朝代或历史语境，并从提供的教学单元中选择最相关的 1-3 个。

请只返回这些教学单元在原始输入数组中的索引（从0开始计数）。例如，如果你选择了第1、3、5项，则返回 [1, 3, 5]。

题目内容如下：
${quizText}

可供选择的教学单元包括：
${units.map((u, i) => `索引 ${i}: ${u}`).join('\n')}

你应根据国家、时代背景、关键词、设问重点等维度，判断哪几个单元最可能与该题有关。`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            response_format: {
                type: 'json_schema',
                json_schema: schema,
            },
        });

        try {
            const parsed = JSON.parse(response.choices[0].message?.content || '{}');
            const indexes: number[] = parsed.indexes ?? [];
            return indexes.map(i => units[i]).filter(Boolean);
        } catch {
            return [];
        }
    }

    getStructuredHierarchyStrings(points: KnowledgePoint[]): string[] {
        const result: string[] = [];

        const grouped = new Map<
            string, // volume + unit
            Map<string, // lesson
                Map<string, // sub
                    KnowledgePoint[] // topics
                >
            >
        >();

        for (const kp of points) {
            const volumeUnit = `${kp.volume}::${kp.unit}`;
            if (!grouped.has(volumeUnit)) {
                grouped.set(volumeUnit, new Map());
            }

            const lessonMap = grouped.get(volumeUnit)!;
            if (!lessonMap.has(kp.lesson)) {
                lessonMap.set(kp.lesson, new Map());
            }

            const subMap = lessonMap.get(kp.lesson)!;
            if (!subMap.has(kp.sub)) {
                subMap.set(kp.sub, []);
            }

            subMap.get(kp.sub)!.push(kp);
        }

        for (const [volumeUnit, lessonMap] of grouped.entries()) {
            const [, unit] = volumeUnit.split('::');
            result.push(`${unit}`);
            for (const [lesson, subMap] of lessonMap.entries()) {
                result.push(`${lesson}`);
                for (const [sub, points] of subMap.entries()) {
                    result.push(`${sub}`);
                    for (const kp of points) {
                        result.push(`{id: ${kp.id}, topic: ${kp.topic}}`);
                    }
                }
            }
        }

        return result;
    }

    async disambiguateTopicFromCandidates(
        quizText: string,
        knowledgePoints: KnowledgePoint[],
    ): Promise<{ selectedId: string; candidateIds: string[] }> {
        this.logger.log(`筛选知识点：
${quizText}
Candidates:
${JSON.stringify(knowledgePoints, null, 2)}
    `);

        const schema = {
            name: 'disambiguate_topic',
            description: '从多个候选知识点中选择最相关的一项，并返回最多三个备选项',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    selectedId: {
                        type: 'string',
                        description: '最终选择的知识点 ID',
                    },
                    candidateIds: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '最多三个与该题相关的候选知识点 ID（含 selectedId）',
                        minItems: 1,
                        maxItems: 3,
                    },
                },
                required: ['selectedId', 'candidateIds'],
                additionalProperties: false,
            },
        };

        const hierarchyDescription = this.getStructuredHierarchyStrings(knowledgePoints).join('\n');

        const prompt = `你是一位中学历史命题与教学专家，擅长分析历史选择题背后的考查意图。

请根据下列选择题内容、子目分类和提供的多个候选知识点，选择其中最贴切、最能准确覆盖该题目考查意图的知识点，并返回其 ID。

同时返回不超过三个相关度较高的备选知识点 ID（包括最终选中的）。

在判断知识点匹配前，请先分析这道题的“考查重点”属于以下哪类之一（但不限于）：
- 思想主张（如某学派的理论、人物的政治观念）
- 制度变迁（如郡县制、世袭制、科举、改革措施）
- 历史事件（如某场战争、革命、运动、条约）
- 社会结构或文化特征（如农耕文明、宗教传播）
- 历史背景与因果分析（如某事件发生的根本原因或历史影响）

你应根据题干的**设问动词、叙述语境、答案信息**来判断其真正意图，并据此从候选知识点中做出最佳匹配。

特别注意：
若题干中考查的是人物的主张、流派观点（例如“韩非主张……”、“孔子强调……”），请优先匹配思想流派总结类的知识点（如“诸子思想”、“儒家思想”），而非仅仅体现该思想的某场改革或实践事件（如“商鞅变法”）。

候选知识点结构如下：
${hierarchyDescription}

最终请返回 JSON，包含 selectedId 和 candidateIds 字段（candidateIds 应该是包含 selectedId 的最多三个候选 ID）。`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4.1',
            messages: [
                {
                    role: 'user',
                    content: prompt,
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
            return {
                selectedId: parsed.selectedId ?? '',
                candidateIds: Array.isArray(parsed.candidateIds) ? parsed.candidateIds.slice(0, 3) : [],
            };
        } catch {
            return { selectedId: '', candidateIds: [] };
        }
    }


}