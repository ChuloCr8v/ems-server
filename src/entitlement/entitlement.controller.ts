import { Body, Controller, Delete, Get, Param, Post, Put, Res } from '@nestjs/common';
import { EntitlementService } from './entitlement.service';
import { EntitlementDto, UpdateEntitlement } from './dto/entitlement.dto';
import { Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@Controller('entitlement')
export class EntitlementController {
  constructor(private readonly entitlement: EntitlementService) { }

  // @Auth([Role.ADMIN, Role.LEAVE_MANAGER])
  @Post()
  async createEntitlement(@Body() dto: EntitlementDto, @Res() res: Response) {
    const entitlement = await this.entitlement.createEntitlement(dto);
    return res.status(200).json({ message: `An Entitlement Has Been Created`, entitlement });
  }

  // @Auth([Role.ADMIN])
  @Get()
  async getEntitlements() {
    return await this.entitlement.getEntitlements();
  }

  // @Auth([Role.ADMIN])
  @Get(':id')
  async getEntitlement(@Param('id') id: string) {
    return await this.entitlement.getEntitlement(id);
  }

  // @Auth([Role.ADMIN])
  @Put(':id')
  async updateEntitlement(@Param('id') id: string, @Body() dto: UpdateEntitlement, @Res() res: Response) {
    const entitlement = await this.entitlement.updateEntitlement(id, dto);
    return res.status(200).json({ message: `An Entitlement Has Been Updated`, entitlement });
  }

  // @Auth([Role.ADMIN])
  @Delete(':id')
  async deleteEntitlement(@Param('id') id: string, @Res() res: Response) {
    const entitlement = await this.entitlement.deleteEntitlement(id);
    return res.status(200).json({ message: `An Entitlement Has Been Deleted`, entitlement });
  }
}
