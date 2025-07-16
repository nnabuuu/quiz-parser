import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as _ from 'lodash';

/**
 * 表示从课程知识点表格中提取出的单个知识点。
 *
 * - `volume`: 分册，例如“上册”或“下册”
 * - `unit`: 单元，例如“第一单元”
 * - `lesson`: 单课，例如“第1课”
 * - `sub`: 子目，表示知识点所属的小节或主题分类
 * - `topic`: 知识点内容本身
 * - `id`: 每条知识点的唯一标识符，在加载时生成
 */
export interface KnowledgePoint {
    id: string;
    topic: string;
    volume: string;
    unit: string;
    lesson: string;
    sub: string;
}

@Injectable()
export class KnowledgePointStorage implements OnModuleInit {
    private readonly logger = new Logger(KnowledgePointStorage.name);
    private readonly filePath = path.resolve(__dirname, '../../data/历史知识点.xlsx');
    private knowledgePoints: KnowledgePoint[] = [];

    onModuleInit() {
        this.knowledgePoints = this.loadKnowledgePoints();
        this.logger.log(`${this.knowledgePoints.length} loaded`);
    }

    getAllKnowledgePoints(): KnowledgePoint[] {
        return this.knowledgePoints;
    }

    getAllUnits(): string[] {
        return _.uniqBy(this.knowledgePoints, 'unit').map(kp => kp.unit);
    }

    getKnowledgePointsByUnit(unit: string): KnowledgePoint[] {
        return this.knowledgePoints.filter(kp => kp.unit === unit);
    }

    getKnowledgePointsByUnits(units: string[]): KnowledgePoint[] {
        return this.knowledgePoints.filter(kp => units.includes(kp.unit));
    }

    getKnowledgePointById(kpId: string): KnowledgePoint | undefined {
        return this.knowledgePoints.find(kp => kp.id === kpId);
    }

    getKnowledgePointsByIds(kpIds: string[]): KnowledgePoint[] {
        return this.knowledgePoints.filter(kp => kpIds.includes(kp.id));
    }

    private loadKnowledgePoints(): KnowledgePoint[] {
        const workbook = XLSX.readFile(this.filePath);
        const result: KnowledgePoint[] = [];

        workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, string>[];

            let lastVolume = '未知册';
            let lastUnit = '未知单元';
            let lastLesson = '未知单课';
            let lastSub = '未知子目';

            rows.forEach((row) => {
                const rawVolume = row['分册']?.trim();
                const rawUnit = row['单元名称']?.trim();
                const rawLesson = row['单课名称']?.trim();
                const rawSub = row['子目']?.trim();
                let topic = row['知识点']?.trim();

                if (rawVolume) lastVolume = rawVolume;
                if (rawUnit) lastUnit = rawUnit;
                if (rawLesson) lastLesson = rawLesson;
                if (rawSub) lastSub = rawSub;

                // 如果知识点为空但子目非空（且不是继承的），将子目作为知识点
                if (!topic && rawSub) {
                    topic = rawSub;
                }

                if (!topic) {
                    this.logger.error(`unknown topic: ${topic}`)
                    return;
                }

                const newKnowledgePoint = {
                    id: uuidv4(),
                    topic,
                    volume: lastVolume,
                    unit: lastUnit,
                    lesson: lastLesson,
                    sub: lastSub,
                }

                this.logger.log(newKnowledgePoint);

                result.push({
                    id: uuidv4(),
                    topic,
                    volume: lastVolume,
                    unit: lastUnit,
                    lesson: lastLesson,
                    sub: lastSub,
                });
            });
        });

        return result;
    }
}