import { Body, Controller, Get, Param, Patch, Post, Res, Req, Delete } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { CreateKpiDto } from './dto/kpi.dto';
import { Response } from 'express';
import { Auth, AuthUser, KpiUser } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

import type { Request } from 'express';

@Controller('kpi')
export class KpiController {
  constructor(private readonly kpi: KpiService) {}

  @Auth([Role.ADMIN, Role.DEPT_MANAGER])
  @Post('categories')
  async createCategory(@KpiUser() userId: string, @Body() data: CreateKpiDto, @Res() res: Response) {
    // const userId = user.sub || user.id;
    const category = await this.kpi.createCategory(userId, data);
    return res.status(200).json({ message: `A New Category Has Been Created`, category });
  }

  @Get('categories')
  async getCategories() {
    return await this.kpi.getCategories();
  }

  @Get('categories/global')
  async getGlobalCategories() {
    return await this.kpi.getGlobalCategories();
  }

  @Auth([Role.ADMIN, Role.DEPT_MANAGER])
  @Patch('categories/:categoryId')
  async updateCategory(
    @Req() req: Request & { user?: any },
    @Param('categoryId') categoryId: string,
    @Body() data: CreateKpiDto,
    @Res() res: Response
  ) {
    const user = req.user;
    const category = await this.kpi.updateCategory(user, categoryId, data);
    return res.status(200).json({ message: 'Category Updated Successfully', category });
  }

  @Auth([Role.ADMIN, Role.DEPT_MANAGER])
  @Delete('categories/:categoryId')
  async removeCategory(
    @Req() req: Request & { user?: any },
    @Param('categoryId') categoryId: string,
    @Res() res: Response
  ) {
    const user = req.user;
    await this.kpi.removeCategory(user, categoryId);
    return res.status(200).json({ message: 'Category Deleted Successfully' });
  }
}
