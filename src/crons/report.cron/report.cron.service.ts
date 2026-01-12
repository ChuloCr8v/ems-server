import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportService } from 'src/report/report.service';

@Injectable()
export class ReportsSchedulerService {
    private readonly logger = new Logger(ReportsSchedulerService.name);

    constructor(private readonly reportsService: ReportService) { }

    @Cron('0 0 * * 6', {
        timeZone: 'Africa/Lagos',
    })
    async handleWeeklyReportCron() {
        this.logger.log('Weekly report cron triggered (Saturday 00:00 AM)…');
        await this.reportsService.generateWeeklyReports();
        this.logger.log('Weekly report cron finished.');
    }
}
