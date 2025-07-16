import { Injectable, OnModuleInit } from '@nestjs/common';
import OpenAI from 'openai';
import {KnowledgePoint, KnowledgePointStorage} from "./knowledge-point.storage";
import {ConfigService} from "@nestjs/config";

interface EmbeddingGroup {
    sub: string;
    text: string;
    embedding: number[];
    knowledgePoints: KnowledgePoint[];
}

@Injectable()
export class KnowledgePointEmbeddingService implements OnModuleInit {
    private readonly openai: OpenAI;
    private subEmbeddings: EmbeddingGroup[] = [];

    constructor(private readonly configService: ConfigService,
                private readonly knowledgePointStorage: KnowledgePointStorage) {
        this.openai = new OpenAI({
            apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        });
    }

    onModuleInit() {
        this.initializeEmbeddings();
    }

    private async initializeEmbeddings() {
        const fs = await import('fs/promises');
        const path = await import('path');
        const savePath = path.resolve(__dirname, '../../data/knowledge-point-section.embedding.json');

        // 尝试读取缓存
        try {
            const cached = await fs.readFile(savePath, 'utf8');
            this.subEmbeddings = JSON.parse(cached);
            console.log('[Embedding] Loaded from cache');
            return;
        } catch {
            console.log('[Embedding] No cache found, generating embeddings...');
        }

        const all = this.knowledgePointStorage.getAllKnowledgePoints();
        const groupMap = new Map<string, KnowledgePoint[]>();

        for (const kp of all) {
            const key = kp.sub;
            if (!groupMap.has(key)) {
                groupMap.set(key, []);
            }
            groupMap.get(key)!.push(kp);
        }

        const groups: EmbeddingGroup[] = [];
        const batchTexts: string[] = [];
        const subKeys: string[] = [];
        const subToKPs: Map<string, KnowledgePoint[]> = new Map();

        for (const [sub, kps] of groupMap.entries()) {
            const text = `${sub}：${kps.map((k) => k.topic).join('；')}`;
            batchTexts.push(text);
            subKeys.push(sub);
            subToKPs.set(sub, kps);
        }

        const embeddings = await this.getBatchEmbeddings(batchTexts);

        for (let i = 0; i < embeddings.length; i++) {
            groups.push({
                sub: subKeys[i],
                text: batchTexts[i],
                embedding: embeddings[i],
                knowledgePoints: subToKPs.get(subKeys[i])!,
            });
        }

        this.subEmbeddings = groups;

        await fs.writeFile(savePath, JSON.stringify(groups, null, 2), 'utf8');
        console.log('[Embedding] Saved to cache');
    }

    private async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
        const res = await this.openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: texts,
        });
        return res.data.map((d) => d.embedding);
    }

    async getEmbedding(text: string): Promise<number[]> {
        const res = await this.openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: [text],
        });
        return res.data[0].embedding;
    }

    getTopMatches(inputEmbedding: number[], topN = 3): EmbeddingGroup[] {
        return [...this.subEmbeddings]
            .map((group) => ({
                ...group,
                score: this.cosineSimilarity(inputEmbedding, group.embedding),
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