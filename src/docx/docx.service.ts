import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import * as unzipper from 'unzipper';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocxService {
    async extractYellowHighlights(filePath: string): Promise<any[]> {
        const zip = await unzipper.Open.file(filePath);
        const docXmlEntry = zip.files.find((f) => f.path === 'word/document.xml');
        if (!docXmlEntry) throw new Error('document.xml not found in .docx');

        const content = await docXmlEntry.buffer();
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
        });
        const json = parser.parse(content.toString());

        const result: any[] = [];
        const body = json['w:document']['w:body']['w:p'];
        const paragraphs = Array.isArray(body) ? body : [body];

        for (const p of paragraphs) {
            const runs = Array.isArray(p['w:r']) ? p['w:r'] : [p['w:r']];
            const highlighted: string[] = [];
            const allText: string[] = [];

            for (const r of runs) {
                const text = r['w:t']?.['#text'] || r['w:t'] || '';
                allText.push(text);

                const highlight = r['w:rPr']?.['w:highlight']?.val || r['w:rPr']?.['w:highlight']?.['w:val'];
                if (highlight === 'yellow') {
                    highlighted.push(text);
                }
            }

            if (highlighted.length > 0) {
                result.push({
                    paragraph: allText.join(''),
                    highlighted,
                });
            }
        }

        return result;
    }
}
