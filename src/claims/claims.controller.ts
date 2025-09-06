import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseInterceptors,
  UploadedFile,
  Req,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
  ApiBearerAuth,
  ApiParam,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { ClaimsService } from './claims.service';
import { CreateClaimDto, UpdateClaimDto } from './dto/claims.dto';
import { Role } from '@prisma/client';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { join } from 'path';
import { AuthenticatedRequest } from 'src/types/express';

@ApiTags('Claims')
@ApiBearerAuth()
@Controller('claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Auth([ Role.ADMIN,])
  @Post()
  @ApiOperation({ summary: 'Create a new expense claim' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Claim data with optional proof file',
    type: CreateClaimDto,
  })
  @ApiCreatedResponse({ description: 'Claim successfully created' })
  @UseInterceptors(FileInterceptor('proof'))
  async create(
    @Body() createClaimDto: CreateClaimDto,
    @UploadedFile() file: Express.Multer.File,
     @Req() req: AuthenticatedRequest,
  ) {
    // Extract employee ID from authenticated user
    const userId = req.user.userId;
    
    // If file was uploaded, add the file path to DTO
    if (file) {
      createClaimDto.proofUrl = `/claims/uploads/${file.filename}`;
    }

    return this.claimsService.createClaim(createClaimDto, userId);
  }

  @Auth([Role.ADMIN, Role.MANAGER])
  @Get()
  @ApiOperation({ summary: 'Get all claims' })
  @ApiOkResponse({ description: 'List of all claims' })
  findAll() {
    return this.claimsService.getAllClaims();
  }

  @Auth([ Role.ADMIN, Role.MANAGER])
  @Get('my-claims')
  @ApiOperation({ summary: 'Get current user claims' })
  @ApiOkResponse({ description: 'List of user claims' })
  findMyClaims(@Req() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return this.claimsService.getClaimsByEmployee(userId);
  }

  @Auth([ Role.ADMIN, Role.MANAGER])
  @Get(':id')
  @ApiOperation({ summary: 'Get claim by ID' })
  @ApiParam({ name: 'id', description: 'Claim ID' })
  @ApiOkResponse({ description: 'Claim details' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.claimsService.getClaimById(id);
  }

  @Auth()
  @Put(':id')
  @ApiOperation({ summary: 'Update a claim' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Claim data with optional proof file',
    type: UpdateClaimDto,
  })
  @ApiParam({ name: 'id', description: 'Claim ID' })
  @ApiOkResponse({ description: 'Claim successfully updated' })
  @UseInterceptors(FileInterceptor('proof'))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateClaimDto: UpdateClaimDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    // If file was uploaded, add the file path to DTO
    if (file) {
      updateClaimDto.proofUrl = `/claims/uploads/${file.filename}`;
    }

    return this.claimsService.updateClaim(id, updateClaimDto);
  }

  @Auth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a claim' })
  @ApiParam({ name: 'id', description: 'Claim ID' })
  @ApiOkResponse({ description: 'Claim successfully deleted' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.claimsService.deleteClaim(id);
  }

  @Auth([Role.ADMIN, Role.MANAGER])
  @Put(':id/approve')
  @ApiOperation({ summary: 'Approve a claim' })
  @ApiParam({ name: 'id', description: 'Claim ID' })
  @ApiOkResponse({ description: 'Claim successfully approved' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.claimsService.approveClaim(id);
  }

  @Auth([Role.ADMIN, Role.MANAGER])
  @Put(':id/reject')
  @ApiOperation({ summary: 'Reject a claim' })
  @ApiParam({ name: 'id', description: 'Claim ID' })
  @ApiOkResponse({ description: 'Claim successfully rejected' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.claimsService.rejectClaim(id);
  }

  @Auth([Role.ADMIN, Role.MANAGER])
  @Get('status/:status')
  @ApiOperation({ summary: 'Get claims by status' })
  @ApiParam({ name: 'status', description: 'Claim status (PENDING, APPROVED, REJECTED)' })
  @ApiOkResponse({ description: 'List of claims by status' })
  findByStatus(@Param('status') status: string) {
    return this.claimsService.getClaimsByStatus(status as any);
  }

  @Auth([Role.ADMIN, Role.MANAGER])
  @Get('stats/summary')
  @ApiOperation({ summary: 'Get claims statistics' })
  @ApiOkResponse({ description: 'Claims statistics summary' })
  getStats() {
    return this.claimsService.getClaimsStats();
  }

  @Get('uploads/:filename')
  @ApiOperation({ summary: 'Get uploaded claim proof file' })
  @ApiParam({ name: 'filename', description: 'Proof filename' })
  async getClaimProof(
    @Param('filename') filename: string,
    @Res() res: Response
  ) {
    const filePath = join(process.cwd(), 'uploads', 'claims', filename);
    res.sendFile(filePath);
  }
}