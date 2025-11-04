import { Body, Controller, Param, Patch, Post, Res, Delete, Req, Request, UseGuards, Get, ForbiddenException, Query } from '@nestjs/common';
import { AppraisalService } from './appraisal.service';
import { FillAppraisalDto, GetAppraisalsDto, GetHRAppraisalsDto, SendToDepartmentDto } from './dto/apppraisal.dto';
import { Response } from 'express';
import { AppraisalSchedulerService } from './appraisal-scheduler.service';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
// import { AuthGuard } from 'src/auth/guards/auth.guard';
// import { Roles } from 'src/auth/decorators/roles.decorator';
// import { RolesGuard } from 'src/auth/guards/roles.guards';
// import { Role } from '@prisma/client';

@Controller('appraisal')
// @UseGuards(AuthGuard, RolesGuard)
export class AppraisalController {
  constructor(private readonly appraisal: AppraisalService, private readonly appraisalScheduler: AppraisalSchedulerService) {}
  @Post(':appraisalId/fill')
  async fillAppraisal(@Request() req, @Param('appraisalId') appraisalId: string, @Body() data: FillAppraisalDto, @Res() res: Response) {
    const userId = req.user.sub;
    const appraisal = this.appraisal.fillAppraisal(userId, appraisalId, data);
    return res.status(200).json({ message: `A New Aprraisal Has Been Filled`, appraisal });
  }

  @Post('send')
  async sendAppraisalToTeam(@Body() data: SendToDepartmentDto, @Request() req, @Res() res: Response) {
    const userId = req.user.sub;
    return this.appraisal.sendAppraisalToTeam(userId, data);
    // return res.status(200).json({ message: `Appraisal for ${data.quarter} has been sent to team`, appraisal});
  }

  @Auth([Role.USER, Role.DEPT_MANAGER, Role.HR, Role.ADMIN])
  @Get()
  async getUserAppraisals(@Req() req, @Query() filters: GetAppraisalsDto,){
    const user = req.user; // Extracted from JWT
    const userId = user.id;
    const userRole = user.role;

    // Optional: restrict normal users from adding HR/Admin filters
    if (
      (userRole === Role.USER || userRole === Role.DEPT_MANAGER) &&
      (filters as GetHRAppraisalsDto).departmentId
    ) {
      throw new ForbiddenException('Unauthorized filter usage');
    }

    return await this.appraisal.getUserAppraisals(userId, userRole, filters);
  }

  // @Post('generate')
  // async generateAppraisal(@Body() body: { quarter: string; year: number}) {
  //   return this.appraisalScheduler.generateQuaterlyAppraisals(body);
  // }
}
