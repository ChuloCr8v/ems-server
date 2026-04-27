// pdfshift.service.ts
import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch'; // or native fetch
import { writeFileSync } from 'fs';

@Injectable()
export class PdfshiftService {
  private readonly apiKey = process.env.PDFSHIFT_API_KEY!;

  async generatePayslipPdf(html: string): Promise<Buffer> {
    const url = 'https://api.pdfshift.io/v3/convert/pdf';

    const body = {
      source: html, // raw HTML
      // optionals: e.g., filename, delay, css injection, etc.
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`PDFShift failed: ${response.statusText}`);
    }

    // Read the PDF as a buffer
    const pdfBuffer = await response.arrayBuffer();
    return Buffer.from(pdfBuffer);
  }

  async savePayslipToFile(html: string, filePath: string) {
    const pdfBuffer = await this.generatePayslipPdf(html);
    writeFileSync(filePath, pdfBuffer);
  }
}
