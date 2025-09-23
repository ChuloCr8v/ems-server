// src/claims/claims.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimStatus, Role } from '@prisma/client';
import { ClaimResponseDto, CreateClaimDto, UpdateClaimDto } from './dto/claims.dto';

@Injectable()
export class ClaimsService {
  constructor(private prisma: PrismaService) {}

  async addClaim(userId: string, createClaimDto: CreateClaimDto, files: Express.Multer.File[]) {
    const claim = await this.prisma.claim.create({
      data: {
          title: createClaimDto.title,
          claimType: createClaimDto.claimType,
          amount: createClaimDto.amount,
          dateOfExpense: createClaimDto.dateOfExpense,
          description: createClaimDto.description,
          userId,
          uploads: {
          create: files.map(file => ({
            name: file.originalname,
            path: file.path,
            type: file.mimetype,
            size: file.size,
          })),
        },
      },
      include: {
        uploads: true,
        user: {
          select: {
            id: true,
            // name: true,
            email: true,
          },
        },
      },
    });

    return this.mapToResponseDto(claim);
  }

  async findAll(userId: string, userRole: Role, filters?: { status?: ClaimStatus }) {
    const where = userRole === Role.USER ? { userId } : {};

    if (filters?.status) {
      where['status'] = filters.status;
    }

    const claims = await this.prisma.claim.findMany({
      where,
      include: {
        uploads: true,
        user: {
          select: {
            id: true,
            // name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return claims.map(claim => this.mapToResponseDto(claim));
  }

  async findOne(id: string, userId: string, userRole: Role) {
    const claim = await this.prisma.claim.findUnique({
      where: { id },
      include: {
        uploads: true,
        user: {
          select: {
            id: true,
            // name: true,
            email: true,
          },
        },
      },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    if (userRole === Role.USER && claim.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapToResponseDto(claim);
  }

  async updateClaim(id: string, userId: string, userRole: Role, updateClaimDto: UpdateClaimDto) {
    const claim = await this.findOne(id, userId, userRole);

    if (userRole === Role.USER && updateClaimDto.status) {
      throw new ForbiddenException('Only managers can update claim status');
    }
    const { files, ...updateData } = updateClaimDto as any;

    const updatedClaim = await this.prisma.claim.update({
      where: { id },
      data: updateData,
      include: {
        uploads: true,
        user: {
          select: {
            id: true,
            // name: true,
            email: true,
          },
        },
      },
    });

    return this.mapToResponseDto(updatedClaim);
  }

  async removeClaim(id: string, userId: string, userRole: Role) {
    const claim = await this.findOne(id, userId, userRole);

    if (userRole === Role.USER && claim.userId !== userId) {
      throw new ForbiddenException('You can only delete your own claims');
    }

    await this.prisma.claim.delete({
      where: { id },
    });

    return { message: 'Claim deleted successfully' };
  }

  async updateStatus(id: string, status: ClaimStatus, managerId: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    const updatedClaim = await this.prisma.claim.update({
      where: { id },
      data: { status },
      include: {
        uploads: true,
        user: {
          select: {
            id: true,
            // name: true,
            email: true,
          },
        },
      },
    });
    
    return this.mapToResponseDto(updatedClaim);
  }

  private mapToResponseDto(claim: any): ClaimResponseDto {
    return {
      id: claim.id,
      title: claim.title,
      claimType: claim.claimType,
      amount: claim.amount,
      dateOfExpense: claim.dateOfExpense,
      description: claim.description,
      status: claim.status,
      uploads: claim.uploads.map(image => image.path),
      userId: claim.userId,
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
    };
  }

  
}