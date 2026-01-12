import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { ReportsSchedulerService } from 'src/crons/report.cron/report.cron.service';

@Module({
  providers: [ReportService, ReportsSchedulerService],
  controllers: [ReportController]
})
export class ReportModule { }
