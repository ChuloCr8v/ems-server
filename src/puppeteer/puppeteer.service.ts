// src/puppeteer/puppeteer.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
import type { Browser, Page } from 'puppeteer';
import PQueue from 'p-queue';

@Injectable()
export class PuppeteerService implements OnModuleDestroy {
  private browser: Browser | null = null;

  private readonly pdfQueue = new PQueue({
    concurrency: 2,
  });

  private async teardownBrowser() {
    if (!this.browser) return;

    try {
      await this.browser.close();
    } catch (err) {
      console.warn('[Puppeteer] Failed to close browser', err);
    } finally {
      this.browser = null;
    }
  }

  private registerBrowserCleanup(browser: Browser) {
    browser.once('disconnected', () => {
      console.warn('[Puppeteer] Browser disconnected — resetting instance');
      this.browser = null;
    });
  }

  async getBrowser(headless = true): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    await this.teardownBrowser();

    this.browser = await puppeteer.launch({
      headless,
      // dev only
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-background-networking',
        '--disable-renderer-backgrounding',
        '--disable-features=Translate,BackForwardCache,MediaRouter',
        '--window-size=1280,720',
      ],
    });

    this.registerBrowserCleanup(this.browser);
    return this.browser;
  }

  /* ---------------- PDF rendering ---------------- */

  async renderPdfFromHtml(html: string): Promise<Buffer> {
    return this.pdfQueue.add(async () => {
      const browser = await this.getBrowser(true);
      const page = await browser.newPage();

      try {
        await page.setContent(html, {
          waitUntil: ['domcontentloaded', 'networkidle0'],
          timeout: 30_000,
        });

        await page.emulateMediaType('screen');

        const pdfUint8 = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
        });

        return Buffer.from(pdfUint8);
      } finally {
        await page.close();
      }
    });
  }

  /* ---------------- Shutdown ---------------- */

  async onModuleDestroy() {
    await this.pdfQueue.onIdle(); // wait for active jobs
    await this.teardownBrowser();
  }
}
