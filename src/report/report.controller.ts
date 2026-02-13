import { Controller, Delete, Get, Post, Req, Body } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReqPayload } from 'src/auth/dto/auth.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { bad } from 'src/utils/error.utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDepartmentWeeklyReportDto } from './dto/report.dto';

@Controller('report')
export class ReportController {
  constructor(
    private readonly report: ReportService,
    private readonly prisma: PrismaService,
  ) { }


  @Auth()
  @Post('create')
  createReport(
    @Req() req: ReqPayload,
    @Body() body: CreateDepartmentWeeklyReportDto) {
    const userId = req.user.id;
    return this.report.createReport(body, userId);
  }

  @Auth()
  @Post('generate')
  generateReport() {
    return this.report.generateWeeklyReports();
  }

  @Auth()
  @Get('')
  listReports(@Req() req: ReqPayload) {
    const userId = req.user.id;
    return this.report.listWeeklyReports(userId);
  }


  @Auth()
  @Get('departments')
  listDepartmentReports(@Req() req: ReqPayload) {
    const userId = req.user.id;
    return this.report.listDepartmentWeeklyReports(userId);
  }

  @Auth(["ADMIN", "SUPERADMIN"])
  @Delete('')
  async deleteReport() {
    try {
      await this.prisma.report.deleteMany();
      return { message: 'Reports deleted successfully' };
    } catch (error) {
      bad(error);
    }
  }
}
