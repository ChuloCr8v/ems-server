// src/claims/claims.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Claim, ClaimStatus, Prisma, Role } from '@prisma/client';
import { ClaimResponseDto, CreateClaimDto, UpdateClaimDto } from './dto/claims.dto';
import { UploadsService } from '../uploads/uploads.service';
import { bad, mustHave } from 'src/utils/error.utils';

@Injectable()
export class ClaimsService {
  constructor(
    private prisma: PrismaService,
  ) { }

  async addClaim(userId: string, createClaimDto: CreateClaimDto) {

    const claimId = "CLM" + Date.now().toString().slice(-4);

    const claim = await this.prisma.claim.create({
      data: {
        claimId,
        title: createClaimDto.title,
        claimType: { connect: { id: createClaimDto.claimType } },
        amount: Number(createClaimDto.amount),
        dateOfExpense: new Date(createClaimDto.dateOfExpense),
        description: createClaimDto.description,
        user: {
          connect: {
            id: userId
          }
        },
        proofUrls: createClaimDto.proofUrls
          ? {
            connect: createClaimDto.proofUrls.map((id) => ({ id })),
          }
          : undefined,

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

    return claim
  }

  async addClaimType(claimType: string, description?: string) {
    try {
      const existing = await this.prisma.claimType.findFirst({
        where: {
          title: claimType
        }
      })

      console.log(existing)
      if (existing) bad("Claim type already exists")

      const newClaimType = await this.prisma.claimType.create({
        data: {
          title: claimType,
          description: description ?? undefined
        },
      });

      return newClaimType;
    } catch (error) {
      console.log(error)
      bad(error.message)
    }

  }


  async findAll(
    userId: string,
    userRole: Role,
    filters: { status?: ClaimStatus }
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { approver: true },
    });

    const approverDepartmentIds =
      user?.approver?.map((d) => d.departmentId) ?? [];

    const baseWhere: Prisma.ClaimWhereInput = {
      ...(filters.status && { status: filters.status }),
    };

    const claims = await this.prisma.claim.findMany({
      where: baseWhere,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            departments: true,
          },
        },
        proofUrls: true,
        claimType: true
      },
      orderBy: { createdAt: "desc" },
    });

    type ClaimWithUserAndProof = typeof claims[number];

    let res: ClaimWithUserAndProof[] = [];

    if (userRole.includes(Role.ADMIN)) {
      res = claims;
    } else if (approverDepartmentIds.length) {
      res = claims.filter((claim) =>
        claim.user.departments.some((dept) =>
          approverDepartmentIds.includes(dept.id)
        )
      );
    } else {
      res = claims.filter((claim) => claim.userId === userId);
    }

    return res;
  }

  async findAllClaimTypes() {
    try {
      return await this.prisma.claimType.findMany({
        orderBy: {
          createdAt: "desc"
        }
      })
    } catch (error) {
      bad(error.message)
    }
  }


  async findOneClaimType(id: string) {
    try {
      return await this.prisma.claimType.findUnique({ where: { id } })
    } catch (error) {
      bad(error.message)
    }
  }


  async findOne(id: string) {
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
        proofUrls: true,
        claimType: true
      },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    return claim
  }

  async updateClaim(id: string, userRole: Role, updateClaimDto: UpdateClaimDto) {
    const claim = await this.findOne(id);

    if (!claim) mustHave(claim, "Claim not found", 404)

    if (userRole === Role.USER && updateClaimDto.status) {
      throw new ForbiddenException('Only managers can update claim status');
    }

    const updatedClaim = await this.prisma.claim.update({
      where: { id },
      data: {
        ...updateClaimDto,
        claimType: { connect: { id: updateClaimDto.claimType } },
        proofUrls: {
          set: updateClaimDto.proofUrls?.map((id) => ({ id })) || [],
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

    return updatedClaim
  }

  async updateClaimType(id: string, updateClaimTypeDto: { title: string, description: string }) {
    console.log(id, updateClaimTypeDto)
    const claim = await this.prisma.claimType.findUnique({ where: { id } });

    if (!claim) mustHave(claim, "Claim Type not found", 404)

    const updatedClaimType = await this.prisma.claimType.update({
      where: { id },
      data: {
        title: updateClaimTypeDto.title,
        description: updateClaimTypeDto.description

      },

    });

    return updatedClaimType
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

  // async mapToResponseDto(claim: any): Promise<ClaimResponseDto> {
  //   return {
  //     id: claim.id,
  //     title: claim.title,
  //     claimType: claim.claimType,
  //     amount: claim.amount,
  //     dateOfExpense: claim.dateOfExpense,
  //     description: claim.description,
  //     status: claim.status,
  //     proofUrls: await Promise.all(
  //     (claim.proofUrls || []).map(url => this.uploads.getSignedUrl(url)),
  //     ),
  //     userId: claim.userId,
  //     createdAt: claim.createdAt,
  //     updatedAt: claim.updatedAt,
  //   };
  // }


}