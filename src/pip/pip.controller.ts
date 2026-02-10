import { Body, Controller, Get, Param, Patch, Post, Res } from '@nestjs/common';
import { PipService } from './pip.service';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import {
  ApprovePipDto,
  CreatePipDto,
  MarkPipAsCompletedDto,
  RecommendPipDto,
  RejectPipDto,
} from './dto/pip.dto';
import { Response } from 'express';
import { Role } from '@prisma/client';

@Controller('pip')
export class PipController {
  constructor(private readonly pipService: PipService) {}
  @Auth()
  @Post()
  async createPip(
    @AuthUser() user: IAuthUser,
    @Body() data: CreatePipDto,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const pip = await this.pipService.createPip(userId, data);
    return res.status(200).json({ message: 'A New PIP Has Been Created', pip });
  }

  @Auth([Role.HR, Role.ADMIN])
  @Get()
  async getAllPips(@AuthUser() user: IAuthUser) {
    const userId = user.sub;
    return await this.pipService.getAllPips(userId);
  }

  @Auth()
  @Get('me')
  async getMyPips(@AuthUser() user: IAuthUser) {
    const userId = user.sub;
    return await this.pipService.getMyPips(userId);
  }

  @Auth()
  @Patch(':pipId')
  async updatePip(@Param('pipId') pipId: string, @Body() data: Partial<CreatePipDto>, @Res() res: Response) {
    const update = await this.pipService.updatePip(pipId, data);
    return res.status(200).json({ message: 'A New PIP Has Been Updated', update });
  }

  @Auth([Role.DEPT_MANAGER, Role.HR, Role.ADMIN])
  @Post('recommend')
  async recommendPip(
    @AuthUser() user: IAuthUser,
    @Body() data: RecommendPipDto,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const recommendedPip = await this.pipService.recommendPip(userId, data);
    return res
      .status(200)
      .json({ message: 'A New PIP Has Been Recommended', recommendedPip });
  }

  @Auth()
  @Get('recommend')
  async getAllRecommendedPips(@AuthUser() user: IAuthUser) {
    const userId = user.sub;
    return await this.pipService.getAllRecommendedPips(userId);
  }

  @Auth([Role.DEPT_MANAGER, Role.HR, Role.ADMIN])
  @Patch(':pipId/approve')
  async approvePip(
    @AuthUser() user: IAuthUser,
    @Param('pipId') pipId: string,
    @Body() data: ApprovePipDto,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const pip = await this.pipService.approvePip(userId, pipId, data);
    return res.status(200).json({ message: 'PIP Has Been Approved', pip });
  }
  
  @Auth([Role.HR, Role.ADMIN])
  @Patch(':departmentId/approve-department-pips')
  async approveDepartmentsPip(@AuthUser() user: IAuthUser, @Param('departmentId') departmentId: string, @Res() res: Response) {
    const userId = user.sub;
    const pips = await this.pipService.approveDepartmentsPip(userId, departmentId);
    return res.status(200).json({ message: 'Department PIPs Have Been Approved', pips });
  }

  @Auth([Role.DEPT_MANAGER, Role.HR, Role.ADMIN])
  @Patch(':pipId/reject')
  async rejectPip(
    @AuthUser() user: IAuthUser,
    @Param('pipId') pipId: string,
    @Body() data: RejectPipDto,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const pip = await this.pipService.rejectPip(userId, pipId, data);
    return res.status(200).json({ message: 'PIP Has Been Rejected', pip });
  }

  @Auth()
  @Patch(':pipId/complete')
  async markPipAsCompleted(
    @AuthUser() user: IAuthUser,
    @Param('pipId') pipId: string,
    @Body() data: MarkPipAsCompletedDto,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const pip = await this.pipService.markPipAsCompleted(userId, pipId, data);
    return res
      .status(200)
      .json({ message: 'PIP Has Been Marked As Completed', pip });
  }

  @Auth([Role.DEPT_MANAGER])
  @Post(':departmentId')
  async sendToHr(@AuthUser() user: IAuthUser, @Param('departmentId') departmentId: string, @Res() res: Response) {
    const userId = user.sub;
    const pip = await this.pipService.sendToHr(userId, departmentId);
     return res.status(200).json({ message: 'PIP Has Been Sent To HR', pip });
  }
}
