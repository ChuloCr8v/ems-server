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
import { CompetencyService } from './competency.service';
import { CreateCompetencyDto } from './dto/competency.dto';
import { Response } from 'express';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

import type { Request } from 'express';
import { IAuthUser } from 'src/auth/dto/auth.dto';

@Controller(['kpi', 'competency'])
export class CompetencyController {
  constructor(private readonly competency: CompetencyService) { }

  @Auth([Role.ADMIN, Role.HR, Role.SUPERADMIN])
  @Post('categories')
  async createCategory(
    @AuthUser() user: IAuthUser,
    @Body() data: CreateCompetencyDto,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const category = await this.competency.createCategory(userId, data);
    return res
      .status(200)
      .json({ message: `A New Category Has Been Created`, category });
  }

  @Get('categories')
  async getCategories() {
    return await this.competency.getCategories();
  }

  @Get('categories/global')
  async getGlobalCategories() {
    return await this.competency.getGlobalCategories();
  }

  @Auth([Role.ADMIN, Role.HR, Role.SUPERADMIN])
  @Patch('categories/:categoryId')
  async updateCategory(
    @AuthUser() user: IAuthUser,
    @Param('categoryId') categoryId: string,
    @Body() data: CreateCompetencyDto,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    const category = await this.competency.updateCategory(userId, categoryId, data);
    return res
      .status(200)
      .json({ message: 'Category Updated Successfully', category });
  }

  @Auth([Role.ADMIN, Role.HR, Role.SUPERADMIN])
  @Delete('categories/:categoryId')
  async removeCategory(
    @AuthUser() user: IAuthUser,
    @Param('categoryId') categoryId: string,
    @Res() res: Response,
  ) {
    const userId = user.sub;
    await this.competency.removeCategory(userId, categoryId);
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
    const category = await this.competency.approveCategory(userId, categoryId);
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
    const category = await this.competency.denyCategory(userId, categoryId);
    return res
      .status(200)
      .json({ message: 'Category Has Been Denied', category });
  }
}
