import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class PdfGeneratorService {
  async generatePdfFromHtmlFile(filename: string): Promise<Buffer> {
    const filePath = join(__dirname, '..', '..', 'templates', filename);
    const htmlContent = fs.readFileSync(filePath, 'utf8');

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'load' });

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    // ✅ Convert Uint8Array to Node.js Buffer
    const pdfBuffer = Buffer.from(pdfUint8);

    return pdfBuffer;
  }
}
