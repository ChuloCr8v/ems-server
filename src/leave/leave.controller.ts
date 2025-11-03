import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, Res } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/leave.dto';
import { Response } from 'express';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { IAuthUser } from 'src/auth/dto/auth.dto';

@Controller('leave')
export class LeaveController {
  constructor(private readonly leave: LeaveService) { }

  @Post(":userId")
  async createLeaveRequest(
    @Param('userId') userId: string,
    @Body() data: CreateLeaveRequestDto, 
    @Res() res: Response,
  ) {
    const request = await this.leave.createLeaveRequest(userId, data);
    return res.status(200).json({ message: 'Leave Request Created', request });
  }

  @Get(":userId")
  async getAvailableLeaveTypes(@Param('userId') userId: string,) {
    return this.leave.getAvailableLeaveTypes(userId);
  }

  @Auth(["ADMIN", "DEPT_MANAGER", "LEAVE_MANAGER", "HR"])
  @Get("")
  async listLeaveRequests(@AuthUser() req: IAuthUser) {
    return this.leave.listLeaveRequests(req.sub);
  }

  @Auth()
  @Get("/user/:userId")
  async listUserLeaveRequests(@Param("userId") userId: string) {
    return this.leave.listUserLeaveRequests(userId);
  }

  // @Auth()
  @Get('balance/:userId/:typeId')
  async getLeaveBalance(
    @Param('userId') userId: string, 
    @Param('typeId') typeId: string
  ) {
    return this.leave.checkLeaveBalance(userId, typeId);
  }

  @Auth([Role.ADMIN, Role.DEPT_MANAGER, Role.LEAVE_MANAGER])
  @Post('approve/:approvalId/:userId')
  async approveLeaveRequest(@Param('approvalId') approvalId: string, @Param('userId') userId: string, @Body() body?: { note: string }) {
    const { note } = body
    return this.leave.approveLeaveRequest(approvalId, userId, note);
  }

  @Post('reject/:approvalId/:userId')
  async rejectLeaveRequest(@Param('approvalId') approvalId: string, @Param('userId') userId: string, @Body() body?: { note: string }) {
    const { note } = body
    console.log(note)
    return this.leave.rejectLeaveRequest(approvalId, userId, note);

  }

  @Get('history/:leaveRequestId')
  async getApprovalHistory(@Param('leaveRequestId') leaveRequestId: string) {
    return this.leave.getApprovalHistory(leaveRequestId);
  }
}