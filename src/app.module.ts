import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocxModule } from './docx/docx.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 👈 makes ConfigService available everywhere
    }),
    DocxModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
