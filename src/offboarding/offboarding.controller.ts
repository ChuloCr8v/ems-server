import {
  Body,
  Get,
  Controller,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { OffboardingService } from './offboarding.service';
import { Response } from 'express';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';
import { FinanceClearance, Role } from '@prisma/client';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { BulkReturnDto, DepartmentClearanceDto, FinanceClearanceDto, HandoverTaskDto, InitiateExit, ReportAssetDto, UploadHandoverSignatureDto } from './dto/offboarding.dto';

@Controller('offboarding')
export class OffboardingController {
  constructor(private readonly offboarding: OffboardingService) {}

  @Auth([Role.ADMIN, Role.HR])
  @Post()
  async initiateExit(
    @AuthUser() user: IAuthUser,
    @Body() data: InitiateExit,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const exit = await this.offboarding.initiateExit(userId, data);
    return res.status(200).json({ message: `User has initiated Offboarding`, exit });
  }

  @Auth([Role.ADMIN, Role.HR, Role.USER])
  @Get('handover-tasks')
  async getTasksForHandover(
    @AuthUser() user: IAuthUser,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const tasks = await this.offboarding.getTasksForHandover(userId);
    return res.status(200).json({ message: "Tasks fetched successfully", tasks });
  }

  @Auth([Role.ADMIN, Role.HR, Role.USER])
  @Post('task-handover')
  async taskHandOver(
    @AuthUser() user: IAuthUser,
    @Body() data: HandoverTaskDto,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const result = await this.offboarding.taskHandOver(userId, data);
    return res.status(200).json(result);
  }

  @Auth([Role.DEPT_MANAGER])
  @Post(':userId/department-clearance')
  async departmentClearance(
    @Param('userId') userId: string,
    @Body() data: DepartmentClearanceDto,
    @AuthUser() user: IAuthUser,
    @Res() res: Response,
  ) {
    const managerId = user.sub;
    const result = await this.offboarding.departmentClearance(userId, managerId, data);
    return res.status(200).json(result);
  }

  @Auth([Role.RECEIVER])
  @Post('receive-handover')
  async uploadHandoverSignature(
    @Body() data: UploadHandoverSignatureDto,
    @AuthUser() user: IAuthUser,
    @Res() res: Response,
  ) {
    const userId = user.sub
    const result = await this.offboarding.receiverSignature(userId, data);
    return res.status(200).json(result);
  }

  @Auth()
  @Get('handover')
  async getHandover(@AuthUser() user: IAuthUser) {
    const userId = user.sub;
    return await this.offboarding.getHandover(userId);
  }

  @Auth([Role.RECEIVER])
  @Get('receiver')
  async getReceiverHandover(@AuthUser() user: IAuthUser) {
    const userId = user.sub;
    return await this.offboarding.getReceiverHandover(userId);
  }

  // @Auth([Role.DEPT_MANAGER])
  // @Patch(':clearanceId/complete')
  // async completeDepartmentClearance(
  //   @Param('clearanceId') clearanceId: string,
  //   @AuthUser() user: IAuthUser
  // ) {
  //   const managerId = user.sub;
  //   const result = await this.offboarding.completeDepartmentClearance(clearanceId, managerId);
  //   return result;
  // }

  @Auth()
  @Post('return-assets')
  async bulkReturnAssets(@AuthUser() user: IAuthUser, @Body() data: BulkReturnDto, @Res() res: Response) {
    const userId = user.sub
    const assets = await this.offboarding.bulkReturnAssets(userId, data);
    return res.status(200).json({ message: `User has submitted his assets`, assets });
  }

  @Auth([Role.ADMIN, Role.HR, Role.ASSET_MANAGER])
  @Get(':userId/returned-assets')
  async getReturnedAssets(@Param('userId') userId: string) {
    return await this.offboarding.getReturnedAssets(userId);
  }

  @Auth()
  @Get(':userId/asset-assesment')
  async getAssetAssesments(@Param('userId') userId: string) {
    return await this.offboarding.getAssetAssesments(userId);
  }

  @Auth([Role.ASSET_MANAGER])
  @Patch(':assignmentId/report-asset')
  async reportAsset(
    @AuthUser() manager: IAuthUser, 
    @Param('assignmentId') assignmentId: string, 
    @Body() data: ReportAssetDto, 
    @Res() res: Response) {
      const managerId = manager.sub
      const asset = await this.offboarding.reportAsset(managerId, assignmentId, data);
      return res.status(200).json({ message: `A Report Has Been Made On This Asset`, asset})
    }

    @Auth([Role.HR, Role.ADMIN])
    @Post(':userId/finance-clearance')
    async initiateFinanceClearance(
      @Param('userId') userId: string,
      @Body() data: FinanceClearanceDto,
      @Res() res: Response
    ) {
      const result = await this.offboarding.initiateFinanceClearance(userId, data);
      return res.status(200).json(result);
    }

    @Auth([Role.HR, Role.ADMIN])
    @Get(':financeId/manual-debt')
    async addManualDebt(
      @Param('financeId') financeId: string,
      @Body() data: { title: string; amount: number }, 
      @Res() res: Response
    ) {
      const result = await this.offboarding.addManualDebt(financeId, data);
      return res.status(200).json(result);
    }

    @Auth()
    @Get(':userId/finance-clearance')
    async getFinanceClearance(
      @AuthUser() user: IAuthUser,
      @Param('employeeId') employeeId: string,
      @Res() res: Response
    ) {
      const userId = user.sub;
      const finance = await this.offboarding.getFinanceClearance(userId, employeeId);
      return res.status(200).json(finance);
    }

  // @Get()
  // async getAllOffboarding(){
  //   return await this.offboarding.getAllOffboarding();
  // }
}
