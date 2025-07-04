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

@Controller('docx')
export class DocxController {

    constructor(private readonly docxService: DocxService) {
        console.log('DocxController initialized', this.docxService);
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async handleUpload(@UploadedFile() file: Express.Multer.File) {
        const tempPath = path.join(__dirname, '../../temp', file.originalname);
        fs.writeFileSync(tempPath, file.buffer);

        const result = await this.docxService.extractYellowHighlights(tempPath);

        fs.unlinkSync(tempPath); // clean up
        return result;
    }
}
