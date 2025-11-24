import { Module } from '@nestjs/common';
import { AppraisalService } from './appraisal.service';
import { AppraisalController } from './appraisal.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { KpiService } from '../kpi/kpi.service';
import { MailModule } from 'src/mail/mail.module';
import { UserModule } from 'src/user/user.module';
import { AppraisalSchedulerService } from './appraisal-scheduler.service';
import { AppraisalSchedulerController } from './appraisal-scheduler.controller';

@Module({
  imports: [PrismaModule, MailModule, UserModule],
  controllers: [AppraisalController, AppraisalSchedulerController],
  providers: [AppraisalService, KpiService, AppraisalSchedulerService],
})
export class AppraisalModule {}
