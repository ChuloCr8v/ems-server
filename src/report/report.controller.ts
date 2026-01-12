import { Controller, Get, Post, Req } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReqPayload } from 'src/auth/dto/auth.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';

@Controller('report')
export class ReportController {

    constructor(private readonly report: ReportService) { }

    @Post("generate")
    generateReport() {
        return this.report.generateWeeklyReports();
    }

    @Auth()
    @Get("")
    listReports(
        @Req() req: ReqPayload
    ) {
        const userId = req.user.id;
        return this.report.listWeeklyReports(userId)
    }
}
