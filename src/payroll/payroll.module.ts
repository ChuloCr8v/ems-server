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
        host: process.env.REDIS_HOST || 'redis-12629.c276.us-east-1-2.ec2.cloud.redislabs.com',
        port: Number(process.env.REDIS_PORT || 12629),
        username: process.env.REDIS_USERNAME || 'default',
        password: process.env.REDIS_PASSWORD || 'Vav5cErC2eBx3ITlvbopTJgEREx5g5lj',
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
