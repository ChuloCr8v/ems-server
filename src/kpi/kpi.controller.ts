import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  Req,
  Delete,
} from '@nestjs/common';
import { KpiService } from './kpi.service';
import { CreateKpiDto } from './dto/kpi.dto';
import { Response } from 'express';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

import type { Request } from 'express';
import { IAuthUser } from 'src/auth/dto/auth.dto';

@Controller('kpi')
export class KpiController {
  constructor(private readonly kpi: KpiService) {}

  @Auth([Role.ADMIN, Role.DEPT_MANAGER])
  @Post('categories')
  async createCategory(
    @AuthUser() user: IAuthUser,
    @Body() data: CreateKpiDto,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const category = await this.kpi.createCategory(userId, data);
    return res
      .status(200)
      .json({ message: `A New Category Has Been Created`, category });
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
    @AuthUser() user: IAuthUser,
    @Param('categoryId') categoryId: string,
    @Body() data: CreateKpiDto,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const category = await this.kpi.updateCategory(userId, categoryId, data);
    return res
      .status(200)
      .json({ message: 'Category Updated Successfully', category });
  }

  @Auth([Role.ADMIN, Role.DEPT_MANAGER])
  @Delete('categories/:categoryId')
  async removeCategory(
    @AuthUser() user: IAuthUser,
    @Param('categoryId') categoryId: string,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    await this.kpi.removeCategory(userId, categoryId);
    return res.status(200).json({ message: 'Category Deleted Successfully' });
  }

  @Auth([Role.ADMIN])
  @Patch('categories/:categoryId/approve')
  async approveCategory(
    @AuthUser() user: IAuthUser,
    @Param('categoryId') categoryId: string,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const category = await this.kpi.approveCategory(userId, categoryId);
    return res
      .status(200)
      .json({ message: 'Category Has Been Approved', category });
  }

  @Auth([Role.ADMIN])
  @Patch('categories/:categoryId/reject')
  async denyCategory(
    @AuthUser() user: IAuthUser,
    @Param('categoryId') categoryId: string,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const category = await this.kpi.denyCategory(userId, categoryId);
    return res
      .status(200)
      .json({ message: 'Category Has Been Denied', category });
  }
}
