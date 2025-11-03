import { Module } from '@nestjs/common';
import { AppraisalService } from './appraisal.service';
import { AppraisalController } from './appraisal.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { KpiService } from '../kpi/kpi.service';
import { MailModule } from 'src/mail/mail.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [PrismaModule, MailModule, UserModule],
  controllers: [AppraisalController],
  providers: [AppraisalService, KpiService,],
})
export class AppraisalModule {}
