import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TaxService } from './tax.service';
import { PayslipTemplateService } from './template.service';
import { PuppeteerModule } from 'src/puppeteer/puppeteer.module';
import { MailModule } from 'src/mail/mail.module';

import { PayrollCronService } from './payroll-cron.service';

@Module({
  imports: [PrismaModule, PuppeteerModule, MailModule],
  controllers: [PayrollController],
  providers: [
    PayrollService,
    TaxService,
    PayslipTemplateService,
    PayrollCronService,
  ],
})
export class PayrollModule { }
