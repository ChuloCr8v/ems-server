// src/puppeteer/puppeteer.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
import type { Browser, Page } from 'puppeteer';

@Injectable()
export class PuppeteerService implements OnModuleDestroy {
  private browser: Browser | null = null;

  private async teardownBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (err) {
        console.warn('[Puppeteer] Failed to close browser', err);
      } finally {
        this.browser = null;
      }
    }
  }

  private registerBrowserCleanup(browser: Browser) {
    browser.once('disconnected', () => {
      console.warn('[Puppeteer] Browser disconnected — resetting instance.');
      this.browser = null;
    });
  }

  async getBrowser(headless = true): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      await this.teardownBrowser();

      this.browser = await puppeteer.launch({
        headless,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
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
    }

    return this.browser;
  }

  // Core helper used by the queue processor
  async renderPdfFromHtml(html: string): Promise<Buffer> {
    const browser = await this.getBrowser(true);
    const context = await (browser as any).createBrowserContext();
    const page: Page = await context.newPage();

    try {
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30_000,
      });

      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });

      return Buffer.from(pdfUint8);
    } finally {
      await Promise.allSettled([page.close(), context.close()]);
    }
  }

  async onModuleDestroy() {
    await this.teardownBrowser();
  }
}
