import { Module } from '@nestjs/common';
import { DocxService } from './docx.service';
import { DocxController } from './docx.controller';
import {GptController} from "./gpt.controller";
import {GptService} from "./gpt.service";

@Module({
  providers: [DocxService, GptController],
  controllers: [DocxController, GptService]
})
export class DocxModule {}
