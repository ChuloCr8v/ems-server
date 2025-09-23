// src/claims/claims.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimStatus, Role } from '@prisma/client';
import { ClaimResponseDto, CreateClaimDto, UpdateClaimDto } from './dto/claims.dto';
import { UploadsService } from '../uploads/uploads.service'; 

@Injectable()
export class ClaimsService {
  constructor(
            private prisma: PrismaService,
            private uploads: UploadsService,
  ) {}


   private async generateSignedUrl(fileId: string) {
    // return signed URL from uploads service
    return this.uploads.getSignedUrl(fileId);
  }

  async addClaim(userId: string, createClaimDto: CreateClaimDto) {
    const claim = await this.prisma.claim.create({
      data: {
          title: createClaimDto.title,
          claimType: createClaimDto.claimType,
          amount: Number(createClaimDto.amount),
          dateOfExpense: new Date(createClaimDto.dateOfExpense),
          description: createClaimDto.description,
          userId,
           proofUrls: createClaimDto.proofUrls || [], // ✅ store string[] directly
        
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return this.mapToResponseDto(claim);
  }

  async findAll(
  userId: string,
  userRole: Role,
  filters: { status?: ClaimStatus }
): Promise<ClaimResponseDto[]> {
  const where: any = {};

  // If filtering by status
  if (filters.status) {
    where.status = filters.status;
  }

  // Normal users should only see their own claims
  if (userRole !== Role.ADMIN) {
    where.userId = userId;
  }

  const claims = await this.prisma.claim.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Map to DTO
  return claims.map((claim) => ({
    id: claim.id,
    title: claim.title,
    claimType: claim.claimType,
    amount: claim.amount,
    dateOfExpense: claim.dateOfExpense,
    status: claim.status,
    userId: claim.userId,         
    createdAt: claim.createdAt,   
    updatedAt: claim.updatedAt, 
    employee: claim.user
      ? {
          id: claim.user.id,
          firstName: claim.user.firstName,
          lastName: claim.user.lastName,
          email: claim.user.email,
        }
      : null,
  }));
}

  async findOne(id: string): Promise<ClaimResponseDto> {
  const claim = await this.prisma.claim.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!claim) {
    throw new NotFoundException('Claim not found');
  }

  return {
    id: claim.id,
    title: claim.title,
    claimType: claim.claimType,
    amount: claim.amount,
    dateOfExpense: claim.dateOfExpense,
    status: claim.status,
    userId: claim.userId,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
    user: claim.user
      ? {
          id: claim.user.id,
          firstName: claim.user.firstName,
          lastName: claim.user.lastName,
          email: claim.user.email,
        }
      : null,
  };
}


  async updateClaim(id: string, userRole: Role, updateClaimDto: UpdateClaimDto) {
    const claim = await this.findOne(id);

    if (userRole === Role.USER && updateClaimDto.status) {
      throw new ForbiddenException('Only managers can update claim status');
    }
    const { files, ...updateData } = updateClaimDto as any;

    const updatedClaim = await this.prisma.claim.update({
      where: { id },
      data: updateData,
      include: {
        
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return this.mapToResponseDto(updatedClaim);
  }

  async removeClaim(id: string, userId: string, userRole: Role) {
    const claim = await this.findOne(id);

    if (userRole === Role.USER && claim.userId !== userId) {
      throw new ForbiddenException('You can only delete your own claims');
    }

    await this.prisma.claim.delete({
      where: { id },
    });

    return { message: 'Claim deleted successfully' };
  }

  async updateStatus(id: string, status: 'APPROVED' | 'REJECTED', notes?: string) {
    const claim = await this.prisma.claim.findUnique({ where: { id } });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    return this.prisma.claim.update({
      where: { id },
      data: {
        status,
        notes,
        updatedAt: new Date(),
      },
    });
  }

    async approveClaim(id: string) {
    const claim = await this.prisma.claim.findUnique({ where: { id } });
    if (!claim) throw new NotFoundException("Claim not found");

    return this.prisma.claim.update({
      where: { id },
      data: { status: ClaimStatus.APPROVED },
    });
  }

    async rejectClaim(id: string) {
    const claim = await this.prisma.claim.findUnique({ where: { id } });
    if (!claim) throw new NotFoundException("Claim not found");

    return this.prisma.claim.update({
      where: { id },
      data: { status: ClaimStatus.REJECTED },
    });
  }

  async mapToResponseDto(claim: any): Promise<ClaimResponseDto> {
    return {
      id: claim.id,
      title: claim.title,
      claimType: claim.claimType,
      amount: claim.amount,
      dateOfExpense: claim.dateOfExpense,
      description: claim.description,
      status: claim.status,
      proofUrls: await Promise.all(
      (claim.proofUrls || []).map(url => this.uploads.getSignedUrl(url)),
      ),
      userId: claim.userId,
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
    };
  }

  
}