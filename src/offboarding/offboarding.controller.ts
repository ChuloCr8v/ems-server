import { Body, Get, Controller, Param, Patch, Post, Res, UploadedFiles, UseInterceptors, Req, Header, UploadedFile } from '@nestjs/common';
import { OffboardingService } from './offboarding.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
// import { DebtPaymentDto, InitiateExit, ReturnAsset } from './dto/offboarding.dto';
import { Response } from 'express';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { join } from 'path';
import { createReadStream } from 'fs';
import { DepartmentClearanceDto, HandoverTaskDto, InitiateExit, UploadHandoverSignatureDto } from './dto/offboarding.dto';

@Controller('offboarding')
export class OffboardingController {
  constructor(private readonly offboarding: OffboardingService) { }

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

  @Auth([Role.USER])
  @Post(':userId/department-clearance/handover-signature')
  async uploadHandoverSignature(
    // @Param('userId') userId: string,
    @Body() data: UploadHandoverSignatureDto,
    @AuthUser() user: IAuthUser,
    @Res() res: Response,
  ) {
    // The current authenticated user is the one RECEIVING the task, so user.sub is the recipient
    const userId = user.sub
    const result = await this.offboarding.uploadHandoverESignature(data.handoverUserId, userId, data.signatureId);
    return res.status(200).json(result);
  }

  // @Get()
  // async getAllOffboarding(){
  //   return await this.offboarding.getAllOffboarding();
  // }
}
