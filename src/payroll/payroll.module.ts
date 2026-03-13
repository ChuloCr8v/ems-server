import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TaxService } from './tax.service';
import { PayslipTemplateService } from './template.service';
import { PuppeteerModule } from 'src/puppeteer/puppeteer.module';
import { MailService } from 'src/mail/mail.service';

import { PayrollCronService } from './payroll-cron.service';

@Module({
  imports: [PrismaModule, PuppeteerModule],
  controllers: [PayrollController],
  providers: [
    PayrollService,
    TaxService,
    PayslipTemplateService,
    MailService,
    PayrollCronService,
  ],
})
export class PayrollModule { }
