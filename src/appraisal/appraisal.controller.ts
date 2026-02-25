import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res
} from '@nestjs/common';
import { AppraisalStatus, Role } from '@prisma/client';
import { Response } from 'express';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { AppraisalSchedulerService } from './appraisal-scheduler.service';
import { AppraisalService } from './appraisal.service';
import {
  FillAppraisalDto,
  GetAppraisalsDto
} from './dto/apppraisal.dto';

@Controller('appraisal')
// @UseGuards(AuthGuard, RolesGuard)
export class AppraisalController {
  constructor(
    private readonly appraisal: AppraisalService,
    private readonly appraisalScheduler: AppraisalSchedulerService,
  ) { }
  @Auth([Role.DEPT_MANAGER, Role.USER])
  @Patch(':appraisalId/submit')
  async fillAppraisal(
    @AuthUser() user: IAuthUser,
    @Param('appraisalId') appraisalId: string,
    @Body() data: FillAppraisalDto,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const appraisal = await this.appraisal.submitAppraisal(
      userId,
      appraisalId,
      data,
    );
    return res
      .status(200)
      .json({ message: `Aprraisal Has Been Submitted`, appraisal });
  }

  @Auth([Role.DEPT_MANAGER, Role.USER])
  @Patch(':appraisalId/draft')
  async fillDraftAppraisal(
    @AuthUser() user: IAuthUser,
    @Param('appraisalId') appraisalId: string,
    @Body() data: FillAppraisalDto,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const appraisal = await this.appraisal.submitAppraisal(
      userId,
      appraisalId,
      data,
      true
    );
    return res
      .status(200)
      .json({ message: `Aprraisal Has Been Saved as Draft`, appraisal });
  }

  @Auth([Role.DEPT_MANAGER, Role.USER])
  @Patch(':appraisalId/edit')
  async editAppraisal(
    @AuthUser() user: IAuthUser,
    @Param('appraisalId') appraisalId: string,
    @Body() data: FillAppraisalDto,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const appraisal = await this.appraisal.editAppraisal(
      userId,
      appraisalId,
      data,
    );
    return res
      .status(200)
      .json({ message: `Aprraisal Has Been Updated`, appraisal });
  }

  @Auth([Role.DEPT_MANAGER])
  @Post(':appraisalId/send')
  async sendAppraisalToTeam(
    @AuthUser() user: IAuthUser,
    @Param('appraisalId') appraisalId: string,
    @Body() data: GetAppraisalsDto,
  ) {
    return this.appraisal.sendAppraisalToTeam(user.sub, appraisalId, data);
  }

  // @Auth()
  // @Get()
  // async listAppraisals(@AuthUser() user: IAuthUser) {
  //   return this.appraisal.listAppraisals(user.sub);
  // }

  // @Auth
  @Get(':id')
  async getOneAppraisal(@Param('id') id: string) {
    return this.appraisal.getOneAppraisal(id);
  }

  @Auth()
  @Get()
  async getAppraisalForUser(
    @AuthUser() user: IAuthUser,
    // @Query('filter') data: GetAppraisalsDto,
    @Query('quarter') quarter?: string,
    @Query('year') year?: number,
    @Query('status') status?: AppraisalStatus,
    // @Req() req: Request
  ) {
    return this.appraisal.getAppraisalForUser(user.sub, {
      quarter,
      year,
      status,
    });
  }

  @Get(':appraisalId/feedback-questions')
  async getAppraisalFeedbackQuestions(
    @Param('appraisalId') appraisalId: string,
  ) {
    return this.appraisal.findAppraisalFeedbackQuestion(appraisalId);
  }

  @Get(':appraisalId/rating-summary')
  async getAppraisalRatingSummary(@Param('appraisalId') appraisalId: string) {
    return this.appraisal.getAppraisalRatingSummary(appraisalId);
  }
}
