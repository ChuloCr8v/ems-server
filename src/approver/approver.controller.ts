import { Controller, Get, Post, Body, Param, Delete, Put, ParseUUIDPipe } from '@nestjs/common';
import { ApproverService } from './approver.service';
import { Role } from '@prisma/client';

@Controller('approvers')
export class ApproverController {
  constructor(private readonly approverService: ApproverService) {}

  @Get()
  findAll() {
    return this.approverService.getGlobalApprovers();
  }

  @Get('department/:departmentId')
  findByDepartment(@Param('departmentId', ParseUUIDPipe) departmentId: string) {
    return this.approverService.getApproversForDepartment(departmentId);
  }

  @Get('user/:userId')
  findByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.approverService.getApproversForUser(userId);
  }

  @Post()
  create(
    @Body('userId', ParseUUIDPipe) userId: string,
    @Body('departmentId') departmentId: string | null,
    @Body('role') role: Role,
  ) {
    return this.approverService.createApprover(userId, departmentId, role);
  }

  @Delete(':id')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.approverService.deactivateApprover(id);
  }
}