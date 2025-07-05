import { Injectable } from '@nestjs/common';
import * as unzipper from 'unzipper';
import { XMLParser } from 'fast-xml-parser';

@Injectable()
export class DocxService {
    async extractAllHighlights(filePath: string): Promise<any[]> {
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
        const body = json['w:document']?.['w:body'];
        if (!body) return [];

        const paragraphs = Array.isArray(body['w:p']) ? body['w:p'] : [body['w:p']];

        for (const p of paragraphs) {
            if (!p || typeof p !== 'object') continue;

            const runs = Array.isArray(p['w:r']) ? p['w:r'] : p['w:r'] ? [p['w:r']] : [];
            const allText: string[] = [];
            const highlighted: { text: string; color: string }[] = [];

            for (const r of runs) {
                if (!r || typeof r !== 'object') continue;

                const rawText = r['w:t'];
                const text =
                    typeof rawText === 'object' && rawText['#text']
                        ? rawText['#text']
                        : typeof rawText === 'string'
                            ? rawText
                            : '';

                if (text) allText.push(text);

                const highlight =
                    r['w:rPr']?.['w:highlight']?.val ||
                    r['w:rPr']?.['w:highlight']?.['w:val'];

                if (highlight && text) {
                    highlighted.push({ text, color: highlight });
                }
            }

            // Always include the paragraph, even if no highlights
            result.push({
                paragraph: allText.join(''),
                highlighted, // may be empty
            });
        }

        return result;
    }
}
