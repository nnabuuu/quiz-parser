import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocxModule } from './docx/docx.module';

@Module({
  imports: [DocxModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
