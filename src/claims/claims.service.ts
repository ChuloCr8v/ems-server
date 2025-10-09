// src/claims/claims.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimStatus, Role } from '@prisma/client';
import { ClaimResponseDto, CreateClaimDto, UpdateClaimDto } from './dto/claims.dto';
import { UploadsService } from '../uploads/uploads.service'; 
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class ClaimsService {
  constructor(
            private prisma: PrismaService,
            private uploads: UploadsService,
            private mail: MailService, // Assuming you have a MailService for sending emails
  ) {}


   private async generateSignedUrl(fileId: string) {
    // return signed URL from uploads service
    return this.uploads.getSignedUrl(fileId);
  }

   private generateClaimId(): string {
    // Example: CLM-20250924-AB1234
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `CLM-${datePart}-${randomPart}`;
  }

   async addClaim(userId: string, createClaimDto: CreateClaimDto) {
    const claimId = this.generateClaimId();

    const claim = await this.prisma.claim.create({
      data: {
        claimId, // ✅ generated claimId
        title: createClaimDto.title,
        claimType: createClaimDto.claimType,
        amount: Number(createClaimDto.amount),
        dateOfExpense: new Date(createClaimDto.dateOfExpense),
        description: createClaimDto.description,
        userId,
        // proofUrls: createClaimDto.proofUrls || [],
        proofUrls: {
          connect: createClaimDto.proofUrls.map((id) => ({ id })),
        },

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

     // ✅ Notify Admin Manager
   await this.mail.sendAddClaimMail({
      email: claim.user.email,
      name: `${claim.user.firstName} ${claim.user.lastName}`,
      claimType: claim.claimType,
      amount: claim.amount,
      dateOfExpense: claim.dateOfExpense,
      // reason: claim.reason,
      link: `https://ems.zoracom.com/claims/${claim.id}`,
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
    claimId: claim.claimId,
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
    claimId: claim.claimId,
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
    const claim = await this.prisma.claim.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!claim) throw new NotFoundException("Claim not found");

    const updated = await this.prisma.claim.update({
      where: { id },
      data: { status: ClaimStatus.APPROVED },
    });

    // ✅ Notify User
     await this.mail.sendApproveClaimMail({
      email: claim.user.email,
      name: `${claim.user.firstName} ${claim.user.lastName}`,
      claimType: claim.claimType,
      amount: claim.amount,
      dateOfExpense: claim.dateOfExpense,
    });

    return updated;
  }
  async rejectClaim(id: string, reason: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!claim) throw new NotFoundException("Claim not found");

    const updated = await this.prisma.claim.update({
      where: { id },
      data: { status: ClaimStatus.REJECTED },
    });

    // ✅ Notify User
     await this.mail.sendRejectClaimMail({
      email: claim.user.email,
      name: `${claim.user.firstName} ${claim.user.lastName}`,
      claimType: claim.claimType,
      amount: claim.amount,
      dateOfExpense: claim.dateOfExpense,
      reason: claim.notes,
    });

    return updated;
  }

  async mapToResponseDto(claim: any): Promise<ClaimResponseDto> {
    return {
      id: claim.id,
      claimId: claim.claimId,
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