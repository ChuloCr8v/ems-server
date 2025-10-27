// src/claims/claims.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { CreateClaimDto, UpdateClaimDto } from './dto/claims.dto';
import { ClaimStatus, ClaimType, Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guards';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { Auth, AuthUser } from 'src/auth/decorators/auth.decorator';

@Controller('claims')
@UseGuards(AuthGuard, RolesGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) { }

  @Post()
  async createClaim(
    @AuthUser() req: IAuthUser,
    @Body() data: CreateClaimDto,
  ) {
    return this.claimsService.addClaim(req.sub, data);
  }

  @Auth(["ADMIN"])
  @Post("type")
  async createClaimType(
    @Body() dto: { title: string, description?: string }
  ) {
    return this.claimsService.addClaimType(dto.title, dto.description);
  }

  @Get()
  async findAll(
    @AuthUser() req: IAuthUser,
    @Query('status') status?: ClaimStatus,
  ) {
    const userId = req.sub;
    const userRole = req.role as Role;
    return this.claimsService.findAll(userId, userRole, { status });
  }


  @Get("types")
  async findAllTypes(
  ) {
    return this.claimsService.findAllClaimTypes();
  }


  @Get("type/:id")
  async findOneType(
    @Param('id') id: string
  ) {
    return this.claimsService.findOneClaimType(id);
  }

  // Get single claim by ID
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.claimsService.findOne(id);
  }

  @Patch('update/:id')
  async updateClaim(
    @Param('id') id: string,
    @AuthUser() req: IAuthUser,
    @Body() updateClaimDto: UpdateClaimDto,
  ) {
    const userRole = req.role as Role;
    return this.claimsService.updateClaim(id, userRole, updateClaimDto);
  }


  @Patch('update/type/:id')
  async updateClaimType(
    @Param('id') id: string,
    @Body() updateClaimTypeDto: { id: string, title: string, description: string },
  ) {
    return this.claimsService.updateClaimType(id, updateClaimTypeDto);
  }

  // Delete claim
  @Delete(':id')
  async remove(@Param('id') id: string, @AuthUser() req: IAuthUser) {
    const userId = req.sub;
    const userRole = req.role as Role;
    return this.claimsService.removeClaim(id, userId, userRole);
  }

  // Update claim status (Managers/Admins only)
  @Patch(':id/approve')
  @Roles(Role.DEPT_MANAGER, Role.ADMIN)
  async approveClaim(@Param('id') id: string, @Body() body: { notes?: string }) {
    return this.claimsService.updateStatus(id, 'APPROVED', body.notes);
  }

  @Patch(':id/reject')
  @Roles(Role.DEPT_MANAGER, Role.ADMIN)
  async rejectClaim(@Param('id') id: string, @Body() body: { notes?: string }) {
    return this.claimsService.updateStatus(id, 'REJECTED', body.notes);
  }

}