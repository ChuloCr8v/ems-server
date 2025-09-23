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
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ClaimsService } from './claims.service';
import { CreateClaimDto, UpdateClaimDto } from './dto/claims.dto';
import { ClaimStatus, Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guards';
import { AuthGuard } from 'src/auth/guards/auth.guard';

@Controller('claims')
@UseGuards(AuthGuard, RolesGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  // Create new claim with file uploads
  @Post()
  @UseInterceptors(FilesInterceptor('files'))
  async createClaim(
    @Req() req,
    @Body() createClaimDto: CreateClaimDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const userId = req.user.id;
    return this.claimsService.addClaim(userId, createClaimDto, files || []);
  }

  // Get all claims (user gets only their own, managers/admins get all)
  @Get()
  async findAll(
    @Req() req,
    @Query('status') status?: ClaimStatus,
  ) {
    const userId = req.user.id;
    const userRole = req.user.role as Role;
    return this.claimsService.findAll(userId, userRole, { status });
  }

  // Get single claim by ID
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req) {
    const userId = req.user.id;
    const userRole = req.user.role as Role;
    return this.claimsService.findOne(id, userId, userRole);
  }

  // Update claim
  @Patch(':id')
  async updateClaim(
    @Param('id') id: string,
    @Req() req,
    @Body() updateClaimDto: UpdateClaimDto,
  ) {
    const userId = req.user.id;
    const userRole = req.user.role as Role;
    return this.claimsService.updateClaim(id, userId, userRole, updateClaimDto);
  }

  // Delete claim
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req) {
    const userId = req.user.id;
    const userRole = req.user.role as Role;
    return this.claimsService.removeClaim(id, userId, userRole);
  }

  // Update claim status (Managers/Admins only)
  @Patch(':id/status')
  @Roles(Role.MANAGER, Role.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: ClaimStatus,
    @Req() req,
  ) {
    const managerId = req.user.id;
    return this.claimsService.updateStatus(id, status, managerId);
  }
}
