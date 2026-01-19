import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { ReportsSchedulerService } from 'src/crons/report.cron/report.cron.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  providers: [ReportService, ReportsSchedulerService],
  controllers: [ReportController],
  imports: [PrismaModule]
})
export class ReportModule { }
