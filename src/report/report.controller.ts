import { Controller, Delete, Get, Post, Req } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReqPayload } from 'src/auth/dto/auth.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { bad } from 'src/utils/error.utils';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('report')
export class ReportController {

    constructor(private readonly report: ReportService, private readonly prisma: PrismaService) { }

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

    @Delete("")
    async deleteReport() {
        try {
            await this.prisma.report.deleteMany()
            return { message: "Reports deleted successfully" }
        } catch (error) {
            bad(error)
        }
    }
}
