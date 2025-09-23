<<<<<<< HEAD
import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
=======
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, Res } from '@nestjs/common';
>>>>>>> 3e4fb9b659e96884b0781242a37d1a1ce4bed8ee
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/leave.dto';
import { Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
<<<<<<< HEAD
=======
import { IAuthUser } from 'src/auth/dto/auth.dto';
>>>>>>> 3e4fb9b659e96884b0781242a37d1a1ce4bed8ee

@Controller('leave')
export class LeaveController {
  constructor(private readonly leave: LeaveService) { }

  @Post(":userId")
<<<<<<< HEAD
  async createLeaveRequest(@Param('userId') userId: string, @Body() data: CreateLeaveRequestDto, @Res() res: Response,) {
=======
  async createLeaveRequest(
    @Param('userId') userId: string, 
    @Body() data: CreateLeaveRequestDto, 
    @Res() res: Response,
  ) {
>>>>>>> 3e4fb9b659e96884b0781242a37d1a1ce4bed8ee
    const request = await this.leave.createLeaveRequest(userId, data);
    return res.status(200).json({ message: 'Leave Request Created', request });
  }

  @Get(":userId")
  async getAvailableLeaveTypes(@Param('userId') userId: string,) {
    return this.leave.getAvailableLeaveTypes(userId);
  }

<<<<<<< HEAD
  @Auth(["ADMIN"])
  @Get("")
  async listLeave() {
    return this.leave.listLeave();
=======
  @Auth(["ADMIN", "DEPT_MANAGER", "LEAVE_MANAGER"])
  @Get("")
  async listLeaveRequests(@Req() req: { user: { id: string } }) {
    return this.leave.listLeaveRequests(req.user.id);
  }

  @Auth()
  @Get("/user/:userId")
  async listUserLeave(@Param("userId") userId: string) {
    return this.leave.listUserLeaveRequests(userId);
>>>>>>> 3e4fb9b659e96884b0781242a37d1a1ce4bed8ee
  }

  // @Auth()
  @Get('balance/:userId/:typeId')
<<<<<<< HEAD
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
=======
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

>>>>>>> 3e4fb9b659e96884b0781242a37d1a1ce4bed8ee
  }

  @Get('history/:leaveRequestId')
  async getApprovalHistory(@Param('leaveRequestId') leaveRequestId: string) {
    return this.leave.getApprovalHistory(leaveRequestId);
  }
}
