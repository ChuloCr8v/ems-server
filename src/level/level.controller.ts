import { Body, Controller, Get, Param, Post, Put, Res } from '@nestjs/common';
import { LevelService } from './level.service';
import { LevelDto, UpdateLevelDto } from './dto/level.dto';
import { Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@Controller('level')
export class LevelController {
  constructor(private readonly levelService: LevelService) { }

  @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Post()
  async createLevel(@Body() input: LevelDto, @Res() res: Response) {
    const level = await this.levelService.createLevel(input);
    return res.status(200).json({ message: 'Level created successfully', level });
  }

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Get()
  async getAllLevels() {
    return await this.levelService.getAllLevels();
  }

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Get(':id')
  async getOneLevel(@Param('id') id: string) {
    return await this.levelService.getOneLevel(id);
  }

  // @Auth([Role.ADMIN, Role.SUPERADMIN])
  @Put(':id')
  async updateLevel(@Param('id') id: string, @Body() update: UpdateLevelDto, @Res() res: Response) {
    const level = await this.levelService.updateLevel(id, update);
    return res.status(200).json({ message: 'A Level Has Been Updated', level });
  }
}
