import { Module } from '@nestjs/common';
import { AppraisalService } from './appraisal.service';
import { AppraisalController } from './appraisal.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { UserModule } from 'src/user/user.module';
import { AppraisalSchedulerController } from './appraisal-scheduler.controller';
import { KpiModule } from 'src/kpi/kpi.module';

@Module({
  imports: [PrismaModule, MailModule, UserModule, KpiModule],
  controllers: [AppraisalController, AppraisalSchedulerController],
  providers: [AppraisalService],
})
export class AppraisalModule { }
