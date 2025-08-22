import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignAssetDto, CreateAssetDto, ReportFaultDto, UpdateFaultStatusDto, ImageDto } from './dto/assets.dto';
import { AssetStatus, FaultStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import { bad, mustHave } from 'src/utils/error.utils';

@Injectable()
export class AssetService {
  constructor(private prisma: PrismaService) { }

  private toImageObject(file: Express.Multer.File): ImageDto {
    return {
      url: `/assets/uploads/${file.filename}`,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype
    };
  }

  async createAsset(createAssetDto: CreateAssetDto) {
    const assetId = "ZCL" + Date.now().toString().slice(-6);

    const existing = await this.prisma.asset.findUnique({
      where: { serialNo: createAssetDto.serialNo },
    });
    if (existing) bad(`An asset with serial number ${createAssetDto.serialNo} already exists.`);


    const data = {
      assetId,
      name: createAssetDto.name,
      serialNo: createAssetDto.serialNo,
      category: createAssetDto.category,
      purchaseDate: new Date(createAssetDto.purchaseDate),
      vendor: createAssetDto.vendor,
      cost: Number(createAssetDto.cost),
      description: createAssetDto.description,
      status: AssetStatus.AVAILABLE,
      assetImages: createAssetDto.assetImages
        ? {
          connect: createAssetDto.assetImages.map((id) => ({ id })),
        }
        : undefined,
    };

    try {
      return await this.prisma.asset.create({ data });
    } catch (err) {
      bad(err);
    }
  }


  async getAllAssets() {
    return this.prisma.asset.findMany({
      include: {
        assetImages: true,
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
      orderBy: {
        createdAt: 'desc',
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
        assetImages: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }

    return asset;
  }

  async assignAsset(id: string, dto: AssignAssetDto) {
    const { userId, notes } = dto;

    // Check if asset exists
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });
    mustHave(asset, `Asset with ID ${id} not found`, 404);

    // ✅ Prevent assigning an already assigned asset
    if (asset.status === AssetStatus.ASSIGNED) {
      bad(`Asset with ID ${id} is already assigned`, 409);
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    mustHave(user, `User with ID ${userId} not found`, 404);

    // Create assignment record
    const assignment = await this.prisma.assignment.create({
      data: {
        assetId: id,
        userId,
        assignedAt: new Date(),
        notes,
        status: "ASSIGNED",
        condition: "GOOD",
      },
    });

    // Update asset status
    await this.prisma.asset.update({
      where: { id },
      data: { status: AssetStatus.ASSIGNED },
    });

    return {
      message: 'Asset assigned successfully',
      assignment,
    };
  }



  async updateAsset(
    id: string,
    updateAssetDto: CreateAssetDto,
  ) {
    const existing = await this.prisma.asset.findUnique({
      where: { id },
      include: { assetImages: true },
    });

    mustHave(existing, `Asset with ID ${id} not found`, 404);

    // Check serial number uniqueness
    if (
      updateAssetDto.serialNo &&
      updateAssetDto.serialNo !== existing.serialNo
    ) {
      const serialNoExists = await this.prisma.asset.findUnique({
        where: { serialNo: updateAssetDto.serialNo },
      });
      if (serialNoExists) {
        bad(`An asset with serial number ${updateAssetDto.serialNo} already exists.`);
      }
    }

    // Build update data
    const data: any = {
      name: updateAssetDto.name,
      serialNo: updateAssetDto.serialNo,
      category: updateAssetDto.category,
      purchaseDate: updateAssetDto.purchaseDate
        ? new Date(updateAssetDto.purchaseDate)
        : existing.purchaseDate,
      vendor: updateAssetDto.vendor,
      cost: updateAssetDto.cost ?? existing.cost,
      description: updateAssetDto.description,
    };

    // Handle assetImages (relation)
    if (updateAssetDto.assetImages) {
      data.assetImages = {
        set: [], // clear old ones
        connect: updateAssetDto.assetImages.map((id) => ({ id })),
      };
    }

    const updatedAsset = await this.prisma.asset.update({
      where: { id },
      data,
      include: { assetImages: true },
    });

    return updatedAsset;
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
    mustHave(reportFaultDto.assetId, "Asset ID is required");
    mustHave(reportFaultDto.reportedBy, "Reporter ID is required");

    return this.prisma.$transaction(async (prisma) => {
      const asset = await prisma.asset.findUnique({
        where: { id: reportFaultDto.assetId },
        select: { id: true, status: true }
      });
      mustHave(asset, `Asset with ID ${reportFaultDto.assetId} not found`, 404);

      const userExists = await prisma.user.count({
        where: { id: reportFaultDto.reportedBy },
      });
      mustHave(userExists, `User with ID ${reportFaultDto.reportedBy} not found`, 404);

      const fault = await prisma.fault.create({
        data: {
          assetId: reportFaultDto.assetId,
          reportedById: reportFaultDto.reportedBy,
          notes: reportFaultDto.notes,
          status: FaultStatus.PENDING,
          createdAt: new Date(),
        },
      });

      if (asset.status !== 'FAULTY') {
        await prisma.asset.update({
          where: { id: reportFaultDto.assetId },
          data: { status: 'FAULTY' },
        });
      }

      const latestAssignment = await prisma.assignment.findFirst({
        where: { assetId: asset.id, status: "ASSIGNED" },
        orderBy: { assignedAt: 'desc' },
      });

      if (latestAssignment) {
        await prisma.assignment.update({
          where: { id: latestAssignment.id },
          data: {
            notes: reportFaultDto.notes,
            condition: "FAULTY",
          },
        });
      }

      return fault;
    });
  }


  async retrieveAsset(
    assetId: string,
    dto: { retrievedById: string; notes?: string }
  ) {
    mustHave(dto.retrievedById, "Retriever ID is required");

    return this.prisma.$transaction(async (prisma) => {
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        include: { faults: true }
      });
      mustHave(asset, "Asset not found", 404);

      const retrieverExists = await prisma.user.count({
        where: { id: dto.retrievedById },
      });
      mustHave(retrieverExists, `User with ID ${dto.retrievedById} not found`, 404);

      const faulty = asset.faults.find(a => a.status === FaultStatus.PENDING);
      const newStatus = faulty ? 'MAINTENANCE' : 'AVAILABLE';

      if (faulty) {
        await prisma.fault.update({
          where: { id: faulty.id },
          data: {
            status: FaultStatus.IN_REVIEW,
            notes: dto.notes
          }
        });
      }

      await prisma.asset.update({
        where: { id: assetId },
        data: { status: newStatus },
      });

      const latestAssignment = await prisma.assignment.findFirst({
        where: { assetId, status: "ASSIGNED" },
        orderBy: { assignedAt: 'desc' },
      });

      if (latestAssignment) {
        await prisma.assignment.update({
          where: { id: latestAssignment.id },
          data: {
            notes: faulty
              ? `Asset retrieved for repair. ${dto.notes || ''}`.trim()
              : `Asset retrieved. ${dto.notes || ''}`.trim(),
            condition: faulty ? "FAULTY" : "GOOD",
            status: "RETURNED"
          },
        });
      }

      return {
        message: 'Asset retrieved successfully',
        assetId,
        newStatus,
        wasFaulty: !!faulty,
        faultId: faulty?.id
      };
    });
  }


  async resolveFault(
    assetId: string,
    dto: { resolvedById: string; notes?: string }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
      });
      mustHave(asset, "Asset not found", 404);

      const resolverExists = await tx.user.count({
        where: { id: dto.resolvedById },
      });
      mustHave(resolverExists, `User with ID ${dto.resolvedById} not found`, 404);

      const fault = await tx.fault.findFirst({
        where: { assetId, status: { not: "RESOLVED" } },
        orderBy: { createdAt: "desc" },
      });
      mustHave(fault, "No active faults found for this asset", 404);

      await tx.fault.update({
        where: { id: fault.id },
        data: {
          status: "RESOLVED",
          resolvedById: dto.resolvedById,
          notes: dto.notes ?? "",
          resolvedAt: new Date(),
        },
      });

      const latestAssignment = await tx.assignment.findFirst({
        where: { assetId, status: "ASSIGNED" },
        orderBy: { assignedAt: "desc" },
      });

      return tx.asset.update({
        where: { id: assetId },
        data: {
          status: latestAssignment ? "ASSIGNED" : "AVAILABLE",
        },
      });
    }).catch((error) => {
      bad(error.message || "Transaction failed", 500);
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

  async getFaultyAssetById(assetId: string) {
    // First check if the asset exists and is faulty
    const asset = await this.prisma.asset.findUnique({
      where: {
        id: assetId,
        status: 'FAULTY' // Ensure we only get faulty assets
      },
      include: {
        faults: {
          orderBy: {
            createdAt: 'desc', // Show most recent faults first
          },
          include: {
            reportedBy: true
          }
        },
        assignments: {
          orderBy: {
            assignedAt: 'desc',
          },
          take: 1, // Get only the most recent assignment
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!asset) {
      throw new NotFoundException(
        `Faulty asset with ID ${assetId} not found or asset is not in FAULTY status`
      );
    }

    // Transform the data for better client consumption
    return {
      ...asset,
      latestFault: asset.faults.length > 0 ? asset.faults[0] : null,
      assignedTo: asset.assignments.length > 0
        ? asset.assignments[0].user
        : null,
      assignmentNotes: asset.assignments.length > 0
        ? asset.assignments[0].notes
        : null,
      faultCount: asset.faults.length
    };
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

  async getAssignedAssetById(assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: {
        id: assetId,
        status: 'ASSIGNED' // Only return if currently assigned
      },
      include: {
        assignments: {
          orderBy: { assignedAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true
              }
            }
          }
        },
        faults: {
          orderBy: { createdAt: 'desc' },
          take: 3 // Get last 3 fault reports
        }
      }
    });

    if (!asset) {
      throw new NotFoundException(
        `Assigned asset with ID ${assetId} not found or asset is not currently assigned`
      );
    }

    return {
      ...asset,
      currentAssignment: asset.assignments[0] || null,
      previousAssignments: asset.assignments.slice(1) || [],
      recentFaults: asset.faults
    };
  }

  async createMultiAssets(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Read the Excel file
    const workbook = XLSX.read(file.buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (!jsonData || jsonData.length === 0) {
      throw new BadRequestException('Excel file is empty');
    }

    const results = [];
    const errors = [];

    for (const [index, row] of jsonData.entries()) {
      try {
        // Validate required fields
        if (!row['name'] || !row['serialNo'] || !row['category']) {
          bad(`Row ${index + 2}: Missing required fields (name, serialNo, category)`);
        }

        // Check if asset with this serialNo already exists
        const existing = await this.prisma.asset.findUnique({
          where: { serialNo: row['serialNo'] },
        });

        if (existing) {
          bad(`Row ${index + 2}: Asset with serial number ${row['serialNo']} already exists`);
        }

        // Prepare asset data
        const assetData: CreateAssetDto = {
          name: row['name'],
          serialNo: row['serialNo'],
          category: row['category'],
          purchaseDate: row['purchaseDate'] ? new Date(row['purchaseDate']) : undefined,
          vendor: row['vendor'] || null,
          cost: row['cost'] ? (row['cost']) : 0,
          description: row['description'] || null,
          assetImage: row['imageUrl'] ? { url: row['imageUrl'] } : null,
          // barcodeImage: null, // Can't handle barcode images in Excel
        };

        // Create the asset
        const asset = await this.createAsset(assetData);
        results.push(asset);
      } catch (error) {
        errors.push({
          row: index + 2, // +2 because Excel rows start at 1 and header is row 1
          error: error.message,
          data: row,
        });
      }
    }

    return {
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors,
    };
  }


  async deleteAsset(id: string) {
    try {
      const asset = await this.prisma.asset.findUnique({ where: { id } });
      if (!asset) {
        throw new NotFoundException("asset Not Found");
      }
      return await this.prisma.asset.delete({
        where: { id },
      });
    } catch (error) {
      throw new InternalServerErrorException(`Failed to delete asset ${error.message}`);
    }
  }

}