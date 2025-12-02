import { Body, Controller, Delete, Get, Param, Post, Put, Req, Res } from '@nestjs/common';
import { EntitlementService } from './entitlement.service';
import { EntitlementDto, UpdateEntitlementDto } from './dto/entitlement.dto';
import { Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { ReqPayload } from 'src/auth/dto/auth.dto';

@Controller('entitlement')
export class EntitlementController {
  constructor(private readonly entitlement: EntitlementService) { }

  @Auth([Role.ADMIN, Role.LEAVE_MANAGER])
  @Post()
  async createEntitlement(@Body() dto: EntitlementDto, @Res() res: Response) {
    const entitlement = await this.entitlement.createEntitlement(dto);
    return res.status(200).json({ message: `An Entitlement Has Been Created`, entitlement });
  }

  @Auth([Role.ADMIN, Role.HR, Role.SUPERADMIN])
  @Get()
  async getEntitlements() {
    return await this.entitlement.getEntitlements();
  }

  @Auth()
  @Get(':id')
  async getEntitlement(@Param('id') id: string) {
    return await this.entitlement.getEntitlement(id);
  }

  @Auth()
  @Get('user/leave')
  async getEmployeeLeaveEntitlement(@Req() req: ReqPayload) {
    return await this.entitlement.getEmployeeLeaveEntitlement(req.user.id, "LEAVE");
  }

  @Auth()
  @Get('user/claims')
  async getEmployeeClaimsEntitlement(@Req() req: ReqPayload) {
    return await this.entitlement.getEmployeeLeaveEntitlement(req.user.id, "CLAIMS");
  }

  @Auth([Role.ADMIN])
  @Put(':id')
  async updateEntitlement(@Param('id') id: string, @Body() dto: UpdateEntitlementDto, @Res() res: Response) {
    const entitlement = await this.entitlement.updateEntitlement(id, dto);
    return res.status(200).json({ message: `An Entitlement Has Been Updated`, entitlement });
  }

  @Auth([Role.ADMIN])
  @Delete(':id')
  async deleteEntitlement(@Param('id') id: string, @Res() res: Response) {
    const entitlement = await this.entitlement.deleteEntitlement(id);
    return res.status(200).json({ message: `An Entitlement Has Been Deleted`, entitlement });
  }
}
