import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, Res } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { CreateTeamDto, DepartmentDto, UpdateTeamDTO } from './dto/department.dto';
import { Response } from 'express';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { IAuthUser, ReqPayload } from 'src/auth/dto/auth.dto';

@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) { }

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Post()
  async createDepartment(@Body() input: DepartmentDto, @Res() res: Response, @Req() req: ReqPayload) {
    const department = await this.departmentService.createDepartment(input);
    return res.status(200).json({ message: `A New Department Has Been Created`, department });
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN, Role.HR])
  @Get()
  async getAllDepartments(
  ) {
    return await this.departmentService.getAllDepartment();
  }

  @Auth()
  @Get("/members")
  async getDepartmentMembers(@Req() req: ReqPayload
  ) {
    return await this.departmentService.getDepartmentMembers(req.user.id);
  }

  @Auth()
  @Get("/:deptId/teams")
  async listTeams(
    @AuthUser() req: IAuthUser,
    @Param("deptId") deptId: string) {
    return await this.departmentService.listTeams(deptId);
  }


  @Auth()
  @Get("/:deptId/team")
  async getTeam(
    @AuthUser() req: IAuthUser,
    @Param("deptId") teamId: string) {
    return await this.departmentService.getTeam(teamId);
  }


  @Auth([Role.ADMIN, Role.SUPERADMIN, Role.HR])
  @Get(':id')
  async getOneDepartment(@Param("id") id: string) {
    return await this.departmentService.getOneDepartment(id);
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN, Role.HR])
  @Put(':id')
  async updateDepartment(@Param('id') id: string, @Body() update: Partial<DepartmentDto>, @Res() res: Response) {
    const department = await this.departmentService.updateDepartment(id, update);
    return res.status(200).json({ message: `Department Has Been Updated`, department });
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Put('add-department-member/:deptId')
  async addDepartmentMembers(@Param('deptId') deptId: string, @Body() userIds: string[], @Res() res: Response) {
    const department = await this.departmentService.addDepartmentMembers(deptId, userIds);
    return res.status(200).json({ message: `Team members has been successfully added`, department });
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Post('add-team/:deptId')
  async addTeamMembers(@Param('deptId') deptId: string, @Res() res: Response, @AuthUser() req: IAuthUser, @Body() data: CreateTeamDto) {
    const createdById = req.sub
    const department = await this.departmentService.addTeam(deptId, createdById, data);
    return res.status(200).json({ message: `Team has created successfully`, department });
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Patch('update-team/:teamId')
  async updateTeam(@Param('teamId') teamId: string, @Res() res: Response, @Body() data: UpdateTeamDTO) {
    const department = await this.departmentService.updateTeam(teamId, data);
    return res.status(200).json({ message: `Team has been updated successfully`, department });
  }


  @Delete(":id")
  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @ApiOperation({ summary: 'Delete a department by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Department ID' })
  @ApiResponse({ status: 200, description: 'Department deleted successfully' })
  async deleteDepartment(@Param('id') id: string, @Res() res: Response) {
    await this.departmentService.deleteDepartment(id);
    return res.status(200).json({ message: `Department has been deleted successfully` });
  }

  @Delete(":id/team")
  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @ApiOperation({ summary: 'Delete a team by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Team deleted successfully' })
  async deleteTeam(@Param('id') id: string, @Res() res: Response) {
    await this.departmentService.deleteTeam(id);
    return res.status(200).json({ message: `Team has been deleted successfully` });
  }
}

