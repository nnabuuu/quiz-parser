import { Module } from '@nestjs/common';
import { DocxService } from './docx.service';
import { DocxController } from './docx.controller';

@Module({
  providers: [DocxService],
  controllers: [DocxController]
})
export class DocxModule {}
