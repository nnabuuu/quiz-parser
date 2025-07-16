// src/knowledge-point/knowledge-point-embedding.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import OpenAI from 'openai';
import { KnowledgePoint, KnowledgePointStorage } from './knowledge-point.storage';
import { ConfigService } from '@nestjs/config';

export interface EmbeddingGroup {
    volume: string; // e.g. 中外历史纲要上
    unit: string;   // e.g. 第一单元 从中华文明起源到秦汉统一...
    lesson: string; // e.g. 第2课 诸侯纷争与变法运动
    sub: string;
    text: string;
    embedding?: number[];
    knowledgePoints: KnowledgePoint[];
}

@Injectable()
export class KnowledgePointEmbeddingService implements OnModuleInit {
    private readonly openai: OpenAI;
    private subEmbeddings: EmbeddingGroup[] = [];
    private embeddingCache: Record<string, number[]> = {};

    constructor(
        private readonly configService: ConfigService,
        private readonly knowledgePointStorage: KnowledgePointStorage,
    ) {
        this.openai = new OpenAI({
            apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        });
    }

    async onModuleInit() {
        await this.initializeEmbeddings();
    }

    private async initializeEmbeddings() {
        const fs = await import('fs/promises');
        const path = await import('path');
        const sectionPath = path.resolve(__dirname, '../../data/knowledge-point-section.embedding.json');
        const cachePath = path.resolve(__dirname, '../../data/embedding-cache.json');

        try {
            const cacheRaw = await fs.readFile(cachePath, 'utf8');
            this.embeddingCache = JSON.parse(cacheRaw);
            console.log('[Embedding] Loaded cache');
        } catch {
            this.embeddingCache = {};
            console.log('[Embedding] No cache found, starting fresh');
        }

        const all = this.knowledgePointStorage.getAllKnowledgePoints();
        const groupMap = new Map<string, KnowledgePoint[]>();

        for (const kp of all) {
            const key = `${kp.volume}:${kp.unit}:${kp.lesson}:${kp.sub}`;
            if (!groupMap.has(key)) groupMap.set(key, []);
            groupMap.get(key)!.push(kp);
        }

        const groups: EmbeddingGroup[] = [];
        const batchTexts: string[] = [];
        const subKeys: string[] = [];

        for (const [key, kps] of groupMap.entries()) {
            const [volume, unit, lesson, sub] = key.split(':');
            const text = `${sub}：${kps.map((k) => k.topic).join('；')}`;
            batchTexts.push(text);
            subKeys.push(key);
            groups.push({ volume, unit, lesson, sub, text, knowledgePoints: kps });
        }

        const embeddings = await this.getBatchEmbeddings(batchTexts);
        for (let i = 0; i < embeddings.length; i++) {
            groups[i].embedding = embeddings[i];
        }

        this.subEmbeddings = groups;
        await fs.writeFile(sectionPath, JSON.stringify(groups, null, 2), 'utf8');
        console.log('[Embedding] Saved section embedding');
    }

    private async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
        const fs = await import('fs/promises');
        const path = await import('path');
        const cachePath = path.resolve(__dirname, '../../data/embedding-cache.json');

        const uncachedTexts: string[] = [];
        const textToIndex = new Map<string, number>();

        texts.forEach((text, index) => {
            if (!this.embeddingCache[text]) {
                uncachedTexts.push(text);
            }
            textToIndex.set(text, index);
        });

        if (uncachedTexts.length > 0) {
            const res = await this.openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: uncachedTexts,
            });

            for (let i = 0; i < uncachedTexts.length; i++) {
                this.embeddingCache[uncachedTexts[i]] = res.data[i].embedding;
            }

            await fs.writeFile(cachePath, JSON.stringify(this.embeddingCache, null, 2), 'utf8');
            console.log(`[Embedding] Cached ${uncachedTexts.length} new embeddings`);
        }

        return texts.map((text) => this.embeddingCache[text]);
    }

    async getEmbedding(text: string): Promise<number[]> {
        if (this.embeddingCache[text]) {
            return this.embeddingCache[text];
        }

        const fs = await import('fs/promises');
        const path = await import('path');
        const cachePath = path.resolve(__dirname, '../../data/embedding-cache.json');

        const res = await this.openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: [text],
        });

        const embedding = res.data[0].embedding;
        this.embeddingCache[text] = embedding;

        await fs.writeFile(cachePath, JSON.stringify(this.embeddingCache, null, 2), 'utf8');
        return embedding;
    }

    getTopMatches(inputEmbedding: number[], unitFilter: string[] = [], topN = 3): EmbeddingGroup[] {
        return [...this.subEmbeddings]
            .filter(group => unitFilter.length === 0 || unitFilter.includes(group.unit))
            .map(group => ({
                ...group,
                score: this.cosineSimilarity(inputEmbedding, group.embedding!),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topN);
    }

    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return dot / (normA * normB);
    }
}