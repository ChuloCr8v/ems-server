import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/leave.dto';
import { Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@Controller('leave')
export class LeaveController {
  constructor(private readonly leave: LeaveService) { }

  @Post(":userId")
  async createLeaveRequest(@Param('userId') userId: string, @Body() data: CreateLeaveRequestDto, @Res() res: Response,) {
    const request = await this.leave.createLeaveRequest(userId, data);
    return res.status(200).json({ message: 'Leave Request Created', request });
  }

  @Get(":userId")
  async getAvailableLeaveTypes(@Param('userId') userId: string,) {
    return this.leave.getAvailableLeaveTypes(userId);
  }

  @Auth(["ADMIN"])
  @Get("")
  async listLeave() {
    return this.leave.listLeave();
  }

  // @Auth()
  @Get('balance/:userId/:typeId')
  async getLeaveBalance(@Param('userId') userId: string, @Param('typeId') typeId: string) {
    return this.leave.checkLeaveBalance(userId, typeId);
  }

  @Auth([Role.ADMIN, Role.DEPT_MANAGER, Role.HR])
  @Post('approve/:approvalId/:userId')
  async approveLeaveRequest(@Param('approvalId') approvalId: string, @Param('userId') userId: string, @Res() res: Response, comment?: string) {
    const request = this.leave.approveLeaveRequest(approvalId, userId, comment);
    return res.status(200).json({ message: 'Leave Request Approved', request });
  }

  @Post('reject/userId:/:approvalId')
  async rejectLeaveRequest(@Param('approvalId') approvalId: string, @Param('userId') userId: string, @Res() res: Response, comment: string) {
    const request = this.leave.rejectLeaveRequest(approvalId, userId, comment);
    return res.status(200).json({ message: 'Leave Request Rejected', request });
  }

  @Get('history/:leaveRequestId')
  async getApprovalHistory(@Param('leaveRequestId') leaveRequestId: string) {
    return this.leave.getApprovalHistory(leaveRequestId);
  }
}
