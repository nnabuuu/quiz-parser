import { Module } from '@nestjs/common';
import { KnowledgePointService } from './knowledge-point.service';
import {KnowledgePointStorage} from "./knowledge-point.storage";
import { KnowledgePointController } from './knowledge-point.controller';
import {KnowledgePointGPTService} from "./knowledge-point-gpt.service";
import {KnowledgePointEmbeddingService} from "./knowledge-point-embedding.service";

@Module({
  providers: [KnowledgePointService,
    KnowledgePointStorage,
    KnowledgePointGPTService,
    KnowledgePointEmbeddingService,],
  controllers: [KnowledgePointController]
})
export class KnowledgePointModule {}
