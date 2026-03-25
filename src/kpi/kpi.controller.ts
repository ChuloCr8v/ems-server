import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { KpiCategoryType, Role } from '@prisma/client';
import { Response } from 'express';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { CreateKpiTemplateDto } from './dto/kpi.dto';
import { KpiService } from './kpi.service';

@Controller('kpi')
export class KpiController {
  constructor(private readonly kpiService: KpiService) { }

  @Auth([Role.ADMIN, Role.SUPERADMIN, Role.DEPT_MANAGER, Role.HR, Role.USER])
  @Get('categories')
  async getCategories(
    @AuthUser() user: IAuthUser,
    @Query('type') type?: KpiCategoryType,
  ) {
    return this.kpiService.getCategories(user.sub, type);
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN, Role.DEPT_MANAGER, Role.HR])
  @Post('categories')
  async createCategory(
    @AuthUser() user: IAuthUser,
    @Body() data: CreateKpiTemplateDto,
    @Res() res: Response,
  ) {
    const category = await this.kpiService.createCategory(user.sub, data);
    return res
      .status(200)
      .json({ message: 'KPI category created successfully', category });
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN, Role.DEPT_MANAGER])
  @Patch('categories/:categoryId')
  async updateCategory(
    @AuthUser() user: IAuthUser,
    @Param('categoryId') categoryId: string,
    @Body() data: CreateKpiTemplateDto,
    @Res() res: Response,
  ) {
    const category = await this.kpiService.updateCategory(
      user.sub,
      categoryId,
      data,
    );
    return res
      .status(200)
      .json({ message: 'KPI category updated successfully', category });
  }

  @Auth([Role.ADMIN, Role.SUPERADMIN, Role.DEPT_MANAGER])
  @Delete('categories/:categoryId')
  async removeCategory(
    @AuthUser() user: IAuthUser,
    @Param('categoryId') categoryId: string,
    @Res() res: Response,
  ) {
    await this.kpiService.removeCategory(user.sub, categoryId);
    return res.status(200).json({ message: 'KPI category deleted successfully' });
  }
}
