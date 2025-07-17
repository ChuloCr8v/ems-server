import { Body, Controller, Delete, Get, Param, Post, Put, Res } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { DepartmentDto } from './dto/department.dto';
import { Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Post()
  async createDepartment(@Body() input: DepartmentDto, @Res() res: Response){
    const department = await this.departmentService.createDepartment(input);
    return res.status(200).json({message: `A New Department Has Been Created`, department});
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Get()
  async getAllDepartments(){
    return await this.departmentService.getAllDepartment();
  }

  @Auth([Role.ADMIN])
  @Get(':id')
  async getOneDepartment(@Param('id') id: string){
    return await this.departmentService.getOneDepartment(id);
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Put(':id')
  async updateDepartment(@Param('id') id: string, @Body() update: DepartmentDto, @Res() res: Response){
    const department = await this.departmentService.updateDepartment(id, update);
    return res.status(200).json({message: `Department Has Been Updated`, department});
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Delete(':id')
  async deleteDepartment(@Param('id') id: string, @Res() res: Response){
    const department = await this.departmentService.deleteDepartment(id);
    return res.status(200).json({ message: `Department Has Been Deleted`, department});
  }
}
