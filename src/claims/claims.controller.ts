import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';


@Controller('claims')
@UseGuards(JwtAuthGuard)
export class ClaimsController {
  constructor(
    private readonly claimsService: ClaimsService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('proof'))
  async createClaim(
    @Body() createClaimDto: CreateClaimDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|gif|pdf|doc|docx)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Request() req,
  ) {
    let proofKey: string | undefined;

    if (file) {
      proofKey = await this.fileUploadService.uploadFile(file);
    }

    return this.claimsService.createClaim(
      {
        ...createClaimDto,
        proofUrl: proofKey,
      },
      req.user.employeeId,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HR)
  async getAllClaims() {
    const claims = await this.claimsService.getAllClaims();
    
    // Generate signed URLs for each claim that has a proof file
    const claimsWithSignedUrls = await Promise.all(
      claims.map(async (claim) => {
        if (claim.proofUrl) {
          const signedUrl = await this.fileUploadService.getSignedUrl(claim.proofUrl);
          return {
            ...claim,
            proofSignedUrl: signedUrl,
          };
        }
        return claim;
      })
    );
    
    return claimsWithSignedUrls;
  }

  @Get('my-claims')
  async getMyClaims(@Request() req) {
    const claims = await this.claimsService.getClaimsByEmployee(req.user.employeeId);
    
    // Generate signed URLs for each claim that has a proof file
    const claimsWithSignedUrls = await Promise.all(
      claims.map(async (claim) => {
        if (claim.proofUrl) {
          const signedUrl = await this.fileUploadService.getSignedUrl(claim.proofUrl);
          return {
            ...claim,
            proofSignedUrl: signedUrl,
          };
        }
        return claim;
      })
    );
    
    return claimsWithSignedUrls;
  }

  @Get(':id')
  async getClaimById(@Param('id') id: string) {
    return this.claimsService.getClaimWithSignedUrl(id);
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('proof'))
  async updateClaim(
    @Param('id') id: string,
    @Body() updateClaimDto: UpdateClaimDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|gif|pdf|doc|docx)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (file) {
      const proofKey = await this.fileUploadService.uploadFile(file);
      updateClaimDto.proofUrl = proofKey;
    }

    return this.claimsService.updateClaim(id, updateClaimDto);
  }

  @Delete(':id')
  async deleteClaim(@Param('id') id: string) {
    return this.claimsService.deleteClaim(id);
  }

  @Put(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.MANAGER)
  async approveClaim(@Param('id') id: string) {
    return this.claimsService.approveClaim(id);
  }

  @Put(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.MANAGER)
  async rejectClaim(@Param('id') id: string) {
    return this.claimsService.rejectClaim(id);
  }

  @Get(':id/proof-url')
  async getProofUrl(@Param('id') id: string) {
    const claim = await this.claimsService.getClaimById(id);
    
    if (!claim.proofUrl) {
      throw new NotFoundException('No proof file found for this claim');
    }

    const signedUrl = await this.fileUploadService.getSignedUrl(claim.proofUrl);
    return { signedUrl };
  }
}