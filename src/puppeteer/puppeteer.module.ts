import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PuppeteerService } from './puppeteer.service';

@Module({
  providers: [PuppeteerService, PrismaService],
  exports: [PuppeteerService],
})
export class PuppeteerModule {}
