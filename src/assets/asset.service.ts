import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignAssetDto, CreateAssetDto, ReportFaultDto, UpdateFaultStatusDto, ImageDto } from './dto/assets.dto';
import { AssetStatus, FaultStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

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

  async createAsset(
    createAssetDto: CreateAssetDto,
    files?: {
      assetImage?: Express.Multer.File[],
      barcodeImage?: Express.Multer.File[]
    }
  ) {
    const existing = await this.prisma.asset.findUnique({
      where: { serialNo: createAssetDto.serialNo },
    });

    if (existing) {
      throw new BadRequestException(`An asset with serial number ${createAssetDto.serialNo} already exists.`);
    }

    const data = {
      name: createAssetDto.name,
      serialNo: createAssetDto.serialNo,
      category: createAssetDto.category,
      purchaseDate: new Date(createAssetDto.purchaseDate),
      vendor: createAssetDto.vendor,
      cost: Number(createAssetDto.cost),
      description: createAssetDto.description,
      status: AssetStatus.AVAILABLE,
      // Store as JSON string in database
      assetImage: files?.assetImage?.[0] ?
        JSON.stringify(this.toImageObject(files.assetImage[0])) :
        createAssetDto.assetImage ? JSON.stringify(createAssetDto.assetImage) : null,
      barcodeImage: files?.barcodeImage?.[0] ?
        JSON.stringify(this.toImageObject(files.barcodeImage[0])) :
        createAssetDto.barcodeImage ? JSON.stringify(createAssetDto.barcodeImage) : null,
    };

    const asset = await this.prisma.asset.create({ data });

    // Parse the JSON strings back to objects for response
    return {
      ...asset,
      assetImage: asset.assetImage ? JSON.parse(asset.assetImage) : null,
      barcodeImage: asset.barcodeImage ? JSON.parse(asset.barcodeImage) : null
    };
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

  async assignAsset(id: string, dto: AssignAssetDto) {
    const { userId, notes } = dto; // ✅ Correct destructuring

    // Check if asset exists
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
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
        assetId: id,
        userId,
        assignedAt: new Date(),
        notes,
      },
    });

    // Update asset status (assuming AssetStatus is enum)
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
  files?: {
    assetImage?: Express.Multer.File[],
    barcodeImage?: Express.Multer.File[]
  }
) {
  const existing = await this.prisma.asset.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundException(`Asset with ID ${id} not found`);
  }

  // Check if serialNo is being changed to one that already exists
  if (updateAssetDto.serialNo && updateAssetDto.serialNo !== existing.serialNo) {
    const serialNoExists = await this.prisma.asset.findUnique({
      where: { serialNo: updateAssetDto.serialNo },
    });

    if (serialNoExists) {
      throw new BadRequestException(`An asset with serial number ${updateAssetDto.serialNo} already exists.`);
    }
  }

  const data = {
    name: updateAssetDto.name,
    serialNo: updateAssetDto.serialNo,
    category: updateAssetDto.category,
    purchaseDate: updateAssetDto.purchaseDate ? new Date(updateAssetDto.purchaseDate) : existing.purchaseDate,
    vendor: updateAssetDto.vendor,
    cost: updateAssetDto.cost ? Number(updateAssetDto.cost) : existing.cost,
    description: updateAssetDto.description,
    // Only update images if new ones are provided
    assetImage: files?.assetImage?.[0] ? 
      JSON.stringify(this.toImageObject(files.assetImage[0])) : 
      updateAssetDto.assetImage ? JSON.stringify(updateAssetDto.assetImage) : existing.assetImage,
    barcodeImage: files?.barcodeImage?.[0] ? 
      JSON.stringify(this.toImageObject(files.barcodeImage[0])) : 
      updateAssetDto.barcodeImage ? JSON.stringify(updateAssetDto.barcodeImage) : existing.barcodeImage,
  };

  const updatedAsset = await this.prisma.asset.update({
    where: { id },
    data,
  });

  // Parse the JSON strings back to objects for response
  return {
    ...updatedAsset,
    assetImage: updatedAsset.assetImage ? JSON.parse(updatedAsset.assetImage) : null,
    barcodeImage: updatedAsset.barcodeImage ? JSON.parse(updatedAsset.barcodeImage) : null
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
          images: reportFaultDto.images.map(img => img.url),
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

    async retrieveAsset(
      faultId: string,
      retrieveDto: {
        verified: boolean;
        notes?: string;
        retrievedById: string;
      }
    ) {
      // Validate input
      if (!retrieveDto.retrievedById) {
        throw new BadRequestException('Retriever ID is required');
      }

      return this.prisma.$transaction(async (prisma) => {
        // 1. Check if fault exists and get associated asset
        const faultWithAsset = await prisma.fault.findUnique({
          where: { id: faultId },
          include: { asset: true },
        });

        if (!faultWithAsset) {
          throw new NotFoundException(`Fault with ID ${faultId} not found`);
        }

        // 2. Check if retriever user exists
        const retrieverExists = await prisma.user.count({
          where: { id: retrieveDto.retrievedById },
        });

        if (!retrieverExists) {
          throw new NotFoundException(`User with ID ${retrieveDto.retrievedById} not found`);
        }

        // 3. Verify the asset is in a faulty state
        if (faultWithAsset.asset.status !== 'FAULTY') {
          throw new BadRequestException(
            `Asset with ID ${faultWithAsset.assetId} is not in FAULTY state`
          );
        }

        // 4. Update the fault record with verification info
        await prisma.fault.update({
          where: { id: faultId },
          data: {
            status: FaultStatus.IN_REVIEW,
            // notes: retrieveDto.notes,
          },
        });

        // 5. Update the asset status to ON_REPAIR
        await prisma.asset.update({
          where: { id: faultWithAsset.assetId },
          data: { status: 'MAINTENANCE' }, // Using MAINTENANCE from your enum
        });

        // 6. Create a retrieval record (could extend Assignment model or create new)
        // Here we'll update the latest assignment if it exists
        const latestAssignment = await prisma.assignment.findFirst({
          where: { assetId: faultWithAsset.assetId },
          orderBy: { assignedAt: 'desc' },
        });

        if (latestAssignment) {
          await prisma.assignment.update({
            where: { id: latestAssignment.id },
            data: {
              notes: `Asset retrieved for repair. ${retrieveDto.notes || ''}`.trim(),
              condition: 'UNDER_REPAIR',
            },
          });
        }

        return {
          message: 'Asset successfully retrieved for repair',
          assetId: faultWithAsset.assetId,
          newStatus: 'MAINTENANCE',
          faultId: faultId,
          faultStatus: 'IN_REVIEW',
        };
      });
  }
  
  async resolveFault(faultId: string, updateFaultStatusDto: UpdateFaultStatusDto) {
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
          user: { // Include reporter details
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
          throw new BadRequestException(`Row ${index + 2}: Missing required fields (name, serialNo, category)`);
        }

        // Check if asset with this serialNo already exists
        const existing = await this.prisma.asset.findUnique({
          where: { serialNo: row['serialNo'] },
        });

        if (existing) {
          throw new BadRequestException(`Row ${index + 2}: Asset with serial number ${row['serialNo']} already exists`);
        }

        // Prepare asset data
        const assetData: CreateAssetDto = {
          name: row['name'],
          serialNo: row['serialNo'],
          category: row['category'],
          purchaseDate: row['purchaseDate'] ? new Date(row['purchaseDate']).toISOString() : undefined,
          vendor: row['vendor'] || null,
          cost: row['cost'] ? Number(row['cost']) : 0,
          description: row['description'] || null,
          assetImage: row['imageUrl'] ? { url: row['imageUrl'] } : null,
          // barcodeImage: null, // Can't handle barcode images in Excel
        };

        // Create the asset
        const asset = await this.createAsset(assetData, {});
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

}