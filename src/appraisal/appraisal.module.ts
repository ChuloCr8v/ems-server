import { Module } from '@nestjs/common';
import { AppraisalService } from './appraisal.service';
import { AppraisalController } from './appraisal.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CompetencyService } from '../kpi/competency.service';
import { MailModule } from 'src/mail/mail.module';
import { UserModule } from 'src/user/user.module';
import { AppraisalSchedulerController } from './appraisal-scheduler.controller';

@Module({
  imports: [PrismaModule, MailModule, UserModule],
  controllers: [AppraisalController, AppraisalSchedulerController],
  providers: [AppraisalService, CompetencyService],
})
export class AppraisalModule { }
