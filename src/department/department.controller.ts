import { Body, Controller, Delete, Get, Param, Post, Put, Res } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { DepartmentDto } from './dto/department.dto';
import { Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) { }

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Post()
  async createDepartment(@Body() input: DepartmentDto, @Res() res: Response) {
    const department = await this.departmentService.createDepartment(input);
    return res.status(200).json({ message: `A New Department Has Been Created`, department });
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  // @Auth([Role.ADMIN])
  @Get()
  async getAllDepartments() {
    return await this.departmentService.getAllDepartment();
  }

  @Get("/team/:userId")
  async getTeam(@Param('userId') userId: string) {
    return await this.departmentService.getTeam(userId);
  }

  @Auth([Role.ADMIN])
  @Get(':id')
  async getOneDepartment(@Param('id') id: string) {
    return await this.departmentService.getOneDepartment(id);
  }

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Put(':id')
  async updateDepartment(@Param('id') id: string, @Body() update: Partial<DepartmentDto>, @Res() res: Response) {
    const department = await this.departmentService.updateDepartment(id, update);
    return res.status(200).json({ message: `Department Has Been Updated`, department });
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Put('add-team/:deptId')
  async addTeamMembers(@Param('deptId') deptId: string, @Body() userIds: string[], @Res() res: Response) {
    const department = await this.departmentService.addTeamMembers(deptId, userIds);
    return res.status(200).json({ message: `Teamn members has been successfully added`, department });
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Delete(':id')
  async deleteDepartment(@Param('id') id: string, @Res() res: Response) {
    const department = await this.departmentService.deleteDepartment(id);
    return res.status(200).json({ message: `Department Has Been Deleted`, department });
  }

  @Delete(":id")
  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @ApiOperation({ summary: 'Delete a department by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Department ID' })
  @ApiResponse({ status: 200, description: 'Department deleted successfully' })
  async deleteProspect(@Param('id') id: string, @Res() res: Response) {
    await this.departmentService.deleteDepartment(id);
    return res.status(200).json({ message: `Department has been deleted successfully` });
  }
}

