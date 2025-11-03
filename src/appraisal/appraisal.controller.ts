import { Body, Controller, Get, Param, Patch, Post, Res, Delete, Req, UseGuards } from '@nestjs/common';
import { AppraisalService } from './appraisal.service';
import { CreateAppraisalDto, AddDepartmentKpiObjDto, UpdateDepartmentKpiObjDto, FillAppraisalDto } from './dto/apppraisal.dto';
import { Response } from 'express';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guards';
import { Role } from '@prisma/client';

@Controller('appraisal')
// @UseGuards(AuthGuard, RolesGuard)
export class AppraisalController {
  constructor(private readonly appraisal: AppraisalService) {}
  // @Post(':userId/appraisalId/fill')
  // async fillAppraisal(@Param('userId') userId: string, @Body() data: FillAppraisalDto) {
  //   const apppraisal = this.appraisal.fillAppraisal()
  // }
}
