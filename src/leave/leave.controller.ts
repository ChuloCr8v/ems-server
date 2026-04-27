import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/leave.dto';
import { Response } from 'express';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { IAuthUser, ReqPayload } from 'src/auth/dto/auth.dto';

@Controller('leave')
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Post(':userId')
  async createLeaveRequest(
    @Param('userId') userId: string,
    @Body() data: CreateLeaveRequestDto,
    @Res() res: Response,
  ) {
    const request = await this.leave.createLeaveRequest(userId, data);
    return res.status(200).json({ message: 'Leave Request Created', request });
  }

  @Auth()
  @Get('/entitlements')
  async getAvailableLeaveTypes(@AuthUser() req: IAuthUser) {
    return this.leave.getAvailableLeaveTypes(req.sub);
  }

  @Auth(['ADMIN', 'DEPT_MANAGER', 'LEAVE_MANAGER', 'HR'])
  @Get('')
  async listLeaveRequests(@AuthUser() req: IAuthUser) {
    return this.leave.listLeaveRequests(req.sub);
  }

  @Auth()
  @Get('/user')
  async listUserLeaveRequests(@AuthUser() req: IAuthUser) {
    return this.leave.listUserLeaveRequests(req.sub);
  }

  @Auth()
  @Get('/:id/request')
  async getLeaveRequest(@Param('id') id: string) {
    return this.leave.getLeaveRequest(id);
  }

  @Auth()
  @Post(':leaveRequestId/remind')
  async remindApprover(
    @Param('leaveRequestId', ParseUUIDPipe) leaveRequestId: string,
    @AuthUser() req: IAuthUser,
  ) {
    return this.leave.sendReminder(leaveRequestId, req.sub);
  }

  @Auth()
  @Get('balance/:typeId')
  async getLeaveBalance(
    @AuthUser() req: IAuthUser,
    @Param('typeId') typeId: string,
  ) {
    return this.leave.checkLeaveBalance(req.sub, typeId);
  }

  @Auth([Role.ADMIN, Role.DEPT_MANAGER, Role.LEAVE_MANAGER, Role.SUPERADMIN])
  @Post('approve/:approvalId/:userId')
  async approveLeaveRequest(
    @Param('approvalId') approvalId: string,
    @Param('userId') userId: string,
    @Body() body?: { note: string },
  ) {
    const note = body.note;
    return this.leave.approveLeaveRequest(approvalId, userId, note);
  }

  @Post('reject/:approvalId/:userId')
  async rejectLeaveRequest(
    @Param('approvalId') approvalId: string,
    @Param('userId') userId: string,
    @Body() body?: { note: string },
  ) {
    const { note } = body;
    return this.leave.rejectLeaveRequest(approvalId, userId, note);
  }

  @Get('history/:leaveRequestId')
  async getApprovalHistory(@Param('leaveRequestId') leaveRequestId: string) {
    return this.leave.getApprovalHistory(leaveRequestId);
  }

  @Auth()
  @Delete('delete/:leaveRequestId')
  async deleteLeaveRequest(
    @Param('leaveRequestId') leaveRequestId: string,
    @AuthUser() req: IAuthUser,
  ) {
    return this.leave.deleteLeaveRequest(leaveRequestId, req.sub);
  }

  @Auth()
  @Patch('cancel/:leaveRequestId')
  async cancelLeavequest(
    @Param('leaveRequestId') leaveRequestId: string,
    @AuthUser() req: IAuthUser,
  ) {
    return this.leave.cancelLeaveRequest(leaveRequestId, req.sub);
  }

  //Comments

  @Auth()
  @Post(':id/comment')
  async commentOnRequest(
    @Param('id') id: string,
    @AuthUser() req: IAuthUser,
    @Body() dto: { comment: string; uploads?: string[] },
  ) {
    return this.leave.comment(id, req.sub, dto);
  }
}
