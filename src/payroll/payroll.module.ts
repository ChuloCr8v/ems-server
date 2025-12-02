import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TaxService } from './tax.service';
import { PayslipTemplateService } from './template.service';
import { PuppeteerModule } from 'src/puppeteer/puppeteer.module';
import { BullModule } from '@nestjs/bullmq';
import { PayslipQueueProcessor } from './payslip-queue.processor';
import { MailService } from 'src/mail/mail.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT || 6379),
      },
    }),
    BullModule.registerQueue({
      name: 'payslips',
    }),
    PrismaModule,
    PuppeteerModule,
    BullModule,],
  controllers: [PayrollController],
  providers: [PayrollService, TaxService, PayslipTemplateService,
    PayslipQueueProcessor, MailService

  ],
})
export class PayrollModule { }
