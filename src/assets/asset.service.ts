import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignAssetDto, CreateAssetDto, ReportFaultDto, UpdateFaultStatusDto } from './dto/assets.dto';
import { AssetStatus, FaultStatus } from '@prisma/client';

@Injectable()
export class AssetService {
  constructor(private prisma: PrismaService) {}

  
  async createAsset(createAssetDto: CreateAssetDto) {

     const existing = await this.prisma.asset.findUnique({
    where: { serialNo: createAssetDto.serialNo },
  });

  if (existing) {
    throw new Error(`An asset with serial number ${createAssetDto.serialNo} already exists.`);
  }

    return this.prisma.asset.create({
      data: {
        name: createAssetDto.name,
        serialNo: createAssetDto.serialNo,
        category: createAssetDto.category,
        purchaseDate: new Date(createAssetDto.purchaseDate),
        vendor: createAssetDto.vendor,
        cost: Number(createAssetDto.cost),
        description: createAssetDto.description,
        assetImage: createAssetDto.assetImage,
        barcodeImage: createAssetDto.barcodeImage,
        status: AssetStatus.AVAILABLE,
      }
    });
  }

  async getAllAssets() {
    return this.prisma.asset.findMany({
      include: {
        assignments: {
          orderBy: {
            assignedAt: 'desc',
          },
          take: 1,
          include: {
            user: true,
          },
        },
        faults: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });
  }

  async getAssetById(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        assignments: {
          orderBy: {
            assignedAt: 'desc',
          },
          include: {
            user: true,
          },
        },
        faults: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }

    return asset;
  }

  async assignAsset(assignAssetDto: AssignAssetDto) {
  const { assetId, userId, notes, condition, assignedAt } = assignAssetDto; // ✅ Correct destructuring

  // Check if asset exists
  const asset = await this.prisma.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset) {
    throw new NotFoundException(`Asset with ID ${assetId} not found`);
  }

  // Check if user exists
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundException(`User with ID ${userId} not found`);
  }

  // Create assignment record
  const assignment = await this.prisma.assignment.create({
    data: {
      assetId,
      userId,
      assignedAt: new Date(assignedAt),
      notes,
      condition,
      // status: 'AVAILABLE'
    },
  });

  // Update asset status (assuming AssetStatus is enum)
  await this.prisma.asset.update({
    where: { id: assetId },
    data: { status: AssetStatus.ASSIGNED },
  });

  return {
    message: 'Asset assigned successfully',
    assignment,
  };
}




  // async returnAsset(assetId: string) {
  //   // Find the latest assignment
  //   const latestAssignment = await this.prisma.assignment.findFirst({
  //     where: { assetId, returnedAt: null },
  //     orderBy: { assignedAt: 'desc' },
  //   });

  //   if (!latestAssignment) {
  //     throw new NotFoundException(`No active assignment found for asset with ID ${assetId}`);
  //   }

  //   // Update assignment with return date
  //   await this.prisma.assignment.update({
  //     where: { id: latestAssignment.id },
  //     data: {
  //       returnedAt: new Date(),
  //     },
  //   });

  //   // Update asset status
  //   return this.prisma.asset.update({
  //     where: { id: assetId },
  //     data: {
  //       status: 'AVAILABLE',
  //     },
  //   });
  // }

  // async reportFault(reportFaultDto: ReportFaultDto) {
  //   // Check if asset exists
  //   const asset = await this.prisma.asset.findUnique({
  //     where: { id: reportFaultDto.assetId },
  //   });

  //   if (!asset) {
  //     throw new NotFoundException(`Asset with ID ${reportFaultDto.assetId} not found`);
  //   }

  //   // Check if user exists
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: reportFaultDto.reportedBy },
  //   });

  //   if (!user) {
  //     throw new NotFoundException(`User with ID ${reportFaultDto.reportedBy} not found`);
  //   }

  //   // Create fault report
  //   const fault = await this.prisma.fault.create({
  //     data: {
  //       assetId: reportFaultDto.assetId,
  //       reportedBy: reportFaultDto.reportedBy,
  //       images: reportFaultDto.images,
  //       reason: reportFaultDto.reason,
  //     },
  //   });

  //   // Update asset status
  //   await this.prisma.asset.update({
  //     where: { id: reportFaultDto.assetId },
  //     data: {
  //       status: 'FAULTY',
  //     },
  //   });

  //   return fault;
  // }

  async reportFault(reportFaultDto: ReportFaultDto) {
    // Validate input
    if (!reportFaultDto.assetId) {
        throw new BadRequestException('Asset ID is required');
    }

    if (!reportFaultDto.reportedBy) {
        throw new BadRequestException('Reporter ID is required');
    }

    // Check if asset exists - using transaction for data consistency
    return this.prisma.$transaction(async (prisma) => {
        const asset = await prisma.asset.findUnique({
            where: { id: reportFaultDto.assetId },
            select: { id: true, status: true } // Only select needed fields
        });

        if (!asset) {
            throw new NotFoundException(`Asset with ID ${reportFaultDto.assetId} not found`);
        }

        // Check if user exists
        const userExists = await prisma.user.count({
            where: { id: reportFaultDto.reportedBy },
        });

        if (!userExists) {
            throw new NotFoundException(`User with ID ${reportFaultDto.reportedBy} not found`);
        }

        // Create fault report
        const fault = await prisma.fault.create({
            data: {
                assetId: reportFaultDto.assetId,
                reportedBy: reportFaultDto.reportedBy,
                images: reportFaultDto.images,
                reason: reportFaultDto.reason,
                status: FaultStatus.PENDING, // Explicit status
                createdAt: new Date(), // Timestamp
            },
        });

        // Only update status if not already FAULTY
        if (asset.status !== 'FAULTY') {
            await prisma.asset.update({
                where: { id: reportFaultDto.assetId },
                data: { status: 'FAULTY' },
            });
        }

        return fault;
    });
}

  async updateFaultStatus(faultId: string, updateFaultStatusDto: UpdateFaultStatusDto) {
    const fault = await this.prisma.fault.findUnique({
      where: { id: faultId },
    });

    if (!fault) {
      throw new NotFoundException(`Fault with ID ${faultId} not found`);
    }

    return this.prisma.fault.update({
      where: { id: faultId },
      data: {
        status: updateFaultStatusDto.status,
        resolvedAt: updateFaultStatusDto.status === 'RESOLVED' ? new Date() : null,
      },
    });
  }

  async getFaultyAssets() {
    return this.prisma.asset.findMany({
      where: {
        status: 'FAULTY',
      },
      include: {
        faults: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });
  }

  async getAssignedAssets() {
    return this.prisma.asset.findMany({
      where: {
        status: 'ASSIGNED',
      },
      include: {
        assignments: {
          orderBy: {
            assignedAt: 'desc',
          },
          take: 1,
          include: {
            user: true,
          },
        },
      },
    });
  }
}