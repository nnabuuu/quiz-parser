import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocxModule } from './docx/docx.module';
import { ConfigModule } from '@nestjs/config';
import { KnowledgePointModule } from './knowledge-point/knowledge-point.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DocxModule,
    KnowledgePointModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
