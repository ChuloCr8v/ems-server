import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClaimDto, UpdateClaimDto } from './dto/claims.dto';
import { ClaimStatus } from '@prisma/client';
import { bad, mustHave } from 'src/utils/error.utils';

@Injectable()
export class ClaimsService {
  constructor(private prisma: PrismaService) { }

  async createClaim(createClaimDto: CreateClaimDto, userId: string) {
    const { title, claimType, amount, dateOfExpense, description, proofUrl } = createClaimDto;

    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    mustHave(user, `Employee with ID ${userId} not found`, 404);

    // Validate amount is positive
    if (amount <= 0) {
      bad('Amount must be greater than 0');
    }

    // Validate date is not in the future
    const expenseDate = new Date(dateOfExpense);
    if (expenseDate > new Date()) {
      bad('Date of expense cannot be in the future');
    }

    const data = {
      title,
      claimType,
      amount: Number(amount),
      dateOfExpense: expenseDate,
      description,
      proofUrl,
      status: ClaimStatus.PENDING,
      user: {
        connect: { id: userId }
      }
    };

    try {
      return await this.prisma.claim.create({
        data,
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
    } catch (err) {
      bad(err);
    }
  }

  async getAllClaims() {
    return this.prisma.claim.findMany({
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
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getClaimById(id: string) {
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

    mustHave(claim, `Claim with ID ${id} not found`, 404);

    return claim;
  }

  async getClaimsByEmployee(userId: string) {
    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    mustHave(user, `Employee with ID ${userId} not found`, 404);

    return this.prisma.claim.findMany({
      where: { 
        user: { id: userId } 
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
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateClaim(id: string, updateClaimDto: UpdateClaimDto) {
    const claim = await this.prisma.claim.findUnique({
      where: { id },
    });

    mustHave(claim, `Claim with ID ${id} not found`, 404);

    // Validate that only pending claims can be updated
    if (claim.status !== ClaimStatus.PENDING) {
      bad('Only pending claims can be updated');
    }

    // Build update data
    const data: any = {
      title: updateClaimDto.title,
      claimType: updateClaimDto.claimType,
      description: updateClaimDto.description,
    };

    // Handle amount if provided
    if (updateClaimDto.amount !== undefined) {
      if (updateClaimDto.amount <= 0) {
        bad('Amount must be greater than 0');
      }
      data.amount = Number(updateClaimDto.amount);
    }

    // Handle date if provided
    if (updateClaimDto.dateOfExpense) {
      const expenseDate = new Date(updateClaimDto.dateOfExpense);
      if (expenseDate > new Date()) {
        bad('Date of expense cannot be in the future');
      }
      data.dateOfExpense = expenseDate;
    }

    // Handle proof URL if provided
    if (updateClaimDto.proofUrl !== undefined) {
      data.proofUrl = updateClaimDto.proofUrl;
    }

    try {
      return await this.prisma.claim.update({
        where: { id },
        data,
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
    } catch (err) {
      bad(err);
    }
  }

  async deleteClaim(id: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id },
    });

    mustHave(claim, `Claim with ID ${id} not found`, 404);

    // Validate that only pending claims can be deleted
    if (claim.status !== ClaimStatus.PENDING) {
      bad('Only pending claims can be deleted');
    }

    try {
      return await this.prisma.claim.delete({
        where: { id },
      });
    } catch (err) {
      bad(err);
    }
  }

  async approveClaim(id: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id },
    });

    mustHave(claim, `Claim with ID ${id} not found`, 404);

    // Validate that only pending claims can be approved
    if (claim.status !== ClaimStatus.PENDING) {
      bad('Only pending claims can be approved');
    }

    try {
      return await this.prisma.claim.update({
        where: { id },
        data: { status: ClaimStatus.APPROVED },
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
    } catch (err) {
      bad(err);
    }
  }

  async rejectClaim(id: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id },
    });

    mustHave(claim, `Claim with ID ${id} not found`, 404);

    // Validate that only pending claims can be rejected
    if (claim.status !== ClaimStatus.PENDING) {
      bad('Only pending claims can be rejected');
    }

    try {
      return await this.prisma.claim.update({
        where: { id },
        data: { status: ClaimStatus.REJECTED },
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
    } catch (err) {
      bad(err);
    }
  }

  async getClaimsByStatus(status: ClaimStatus) {
    return this.prisma.claim.findMany({
      where: { status },
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
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getClaimsStats() {
    const total = await this.prisma.claim.count();
    const pending = await this.prisma.claim.count({ where: { status: ClaimStatus.PENDING } });
    const approved = await this.prisma.claim.count({ where: { status: ClaimStatus.APPROVED } });
    const rejected = await this.prisma.claim.count({ where: { status: ClaimStatus.REJECTED } });
    const totalAmount = await this.prisma.claim.aggregate({
      _sum: { amount: true },
      where: { status: ClaimStatus.APPROVED },
    });

    return {
      total,
      pending,
      approved,
      rejected,
      totalAmount: totalAmount._sum.amount || 0,
    };
  }
}