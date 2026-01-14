// Type declarations for puppeteer-extra
declare module 'puppeteer-extra' {
    import type { Browser, LaunchOptions, Product } from 'puppeteer';

    interface PuppeteerExtra {
        launch(options?: LaunchOptions): Promise<Browser>;
        connect(options?: any): Promise<Browser>;
        use(plugin: any): this;
        executablePath(product?: Product): string;
    }

    const puppeteerExtra: PuppeteerExtra;
    export default puppeteerExtra;
}
