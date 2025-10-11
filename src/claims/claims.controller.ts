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
  Put,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ClaimsService } from './claims.service';
import { CreateClaimDto, UpdateClaimDto } from './dto/claims.dto';
import { ClaimStatus, Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guards';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('claims')
@UseGuards(AuthGuard, RolesGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  // Create new claim with file uploads
  @Post()
 @UseInterceptors(FilesInterceptor('files', 10, {
  storage: diskStorage({
    destination: './uploads/claims', // make sure this folder exists
    filename: (req, file, callback) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      callback(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
    },
  }), limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
}))
  async createClaim(
    @Req() req,
    // @Body() createClaimDto: CreateClaimDto,
    @Body() body: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const proofUrls = (files || []).map(file => file.filename);
    const createClaimDto: CreateClaimDto = {
    ...body,
    amount: Number(body.amount), // convert string to number
    dateOfExpense: new Date(body.dateOfExpense), // convert string to Date
    proofUrls, // or however you handle file paths
  };
    const userId = req.user.id;
    return this.claimsService.addClaim(userId, createClaimDto);
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
    return this.claimsService.findOne(id);
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
    return this.claimsService.updateClaim(id, userRole, updateClaimDto);
  }

  // Delete claim
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req) {
    const userId = req.user.id;
    const userRole = req.user.role as Role;
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
