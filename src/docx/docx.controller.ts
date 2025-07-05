import {
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocxService } from './docx.service';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid'; // 👈 install with: npm i uuid

@Controller('docx')
export class DocxController {
    constructor(private readonly docxService: DocxService) {}

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async handleUpload(@UploadedFile() file: Express.Multer.File) {
        const requestId = uuidv4(); // 👈 create a unique ID
        const requestDir = path.join(__dirname, '../../temp', requestId);
        fs.mkdirSync(requestDir, { recursive: true });

        const filePath = path.join(requestDir, file.originalname);
        fs.writeFileSync(filePath, file.buffer);

        const result = await this.docxService.extractAllHighlights(filePath);

        // Optional: clean up after processing
        fs.unlinkSync(filePath);
        fs.rmdirSync(requestDir);

        return result;
    }
}
