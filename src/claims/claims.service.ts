import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateClaimDto, UpdateClaimDto } from '../dto/create-claim.dto';
import { ClaimStatus } from '@prisma/client';
import { FileUploadService } from './file-upload.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ClaimsService {
  constructor(
    private prisma: PrismaService,
    private fileUploadService: FileUploadService,
  ) {}

  // ... other methods remain the same

  async deleteClaim(id: string) {
    const claim = await this.claimPrisma.findById(id);
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    // Delete the associated file from S3 if it exists
    if (claim.proofUrl) {
      await this.fileUploadService.deleteFile(claim.proofUrl);
    }

    return this.claimPrisma.delete(id);
  }

  async updateClaim(id: string, updateClaimDto: UpdateClaimDto) {
    const claim = await this.claimPrisma.findById(id);
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    // If updating the file, delete the old one from S3
    if (updateClaimDto.proofUrl && claim.proofUrl && updateClaimDto.proofUrl !== claim.proofUrl) {
      await this.fileUploadService.deleteFile(claim.proofUrl);
    }

    return this.claimPrisma.update(id, updateClaimDto);
  }

  // Add method to get signed URL for file access
  async getClaimWithSignedUrl(id: string) {
    const claim = await this.claimPrisma.findById(id);
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    // Generate signed URL for the proof file
    if (claim.proofUrl) {
      const signedUrl = await this.fileUploadService.getSignedUrl(claim.proofUrl);
      return {
        ...claim,
        proofSignedUrl: signedUrl,
      };
    }

    return claim;
  }
}