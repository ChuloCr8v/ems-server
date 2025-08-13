import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InitiateExit, ReturnAsset } from './dto/offboarding.dto';
import { UserService } from 'src/user/user.service';
import { Status } from '@prisma/client';
import { bad } from 'src/utils/error.utils';

@Injectable()
export class OffboardingService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly user: UserService,
    ) {}

    async initiateExit(userId: string, data: InitiateExit, uploads: Express.Multer.File[]) {
      const { type, reason, lastWorkDate, noticePeriod } = data;

      try {
        // 1. Verify user is ACTIVE
        const user = await this.user.__findUserById(userId);
        if (user.status !== Status.ACTIVE) {
          throw new BadRequestException('User is not active');
        }

        // 2. Create offboarding record (ensure `userId` is valid)
        const exit = await this.prisma.offboarding.create({
          data: {
            type,
            reason,
            lastWorkDate,
            noticePeriod,
            user: {
              connect: {
                id: userId, 
              },
            },
            checklist: {
              createMany: {
                data: [
                  { task: "Return Assigned Assets" },
                  { task: "Upload Proof of Payment (if applicable)" },
                  { task: "Submit Handover Form" },
                ]
              }
            }
          },
          include: {
            user: true,
          },
        });

        // 3. Handle file uploads (if any)
        if (uploads?.length > 0) {
          const exitUploads = uploads.map((upload) => ({
            name: upload.originalname,
            size: upload.size,
            type: upload.mimetype,
            bytes: upload.buffer,
            offboardingId: exit.id,
          }));

          await this.prisma.upload.createMany({
            data: exitUploads,
          });

          return { exit, exitUploads };
        }

        return { exit };
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new InternalServerErrorException('Failed to initiate exit process');
      }
    }

    async returnAsset(assetId: string, data: ReturnAsset) {
      const { condition } = data;
      try {
        
        const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
        if(!asset) {
          throw bad("Asset Not Found");
        }
        //Check if asset is already RETURNED
        if(asset.status == 'RETURNED') {
          throw bad("Asset Has Already Been Returned");
        }

        //First Update the Asset
        const updatedAsset = await this.prisma.asset.update({
          where: { id: assetId },
          data: {
            isReturned: true,
            status: 'RETURNED',
          },
        });
        // Then Update the Assignment 
          await this.prisma.assignment.updateMany({
          where: { assetId },
          data: {
            condition,
            notes: data.reason
          },
        });

        return updatedAsset;
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new InternalServerErrorException('Failed to initiate exit process');
      }
    }

      async checkAllAssetReturned(offboardingId: string) {
      const offboarding = await this.prisma.offboarding.findUnique({
        where: { id: offboardingId },
        include: { user: true },
      });
      if(!offboarding) {
        throw new NotFoundException('Offboarding record not found');
      }
      //Check if all assets are returned
      const pendingAssets = await this.prisma.asset.count({
        where: {
          assignments: { some: { userId: offboarding.userId } },
          isReturned: false,
        },
      });

      //Update checklist if all returned
      if(pendingAssets === 0) {
        await this.prisma.offboardingChecklist.updateMany({
          where: {
            offboardingId,
            task: 'Return Assigned Assets',
          },
          data: { status: 'COMPLETED'},
        });
        return { success: true, message: 'All Assigned Assets Have Been Returned '};
      }
        return { success: false, message: `${pendingAssets} asset(s) pending return`};
      }


      async approveAllReturnedAssets(offboardingId: string, notes?: string) {
  
            //Get offboarding record with user info
            const offboarding = await this.prisma.offboarding.findUnique({
              where: { id: offboardingId },
              include: { user: true },
            });

            if (!offboarding) {
              throw new NotFoundException('Offboarding record not found');
            }

            //Get all RETURNED but UNVERIFIED assets
            const returnedAssets = await this.prisma.assignment.findMany({
              where: {
                userId: offboarding.userId,
                asset: { isReturned: true },
                isVerified: false,
              },
              include: { asset: true },
            });

            if (returnedAssets.length === 0) {
              throw new BadRequestException('No pending assets to approve');
            }

            //Bulk update verification status
            await this.prisma.$transaction([
              // Update all assignments
              this.prisma.assignment.updateMany({
                where: {
                  id: { in: returnedAssets.map(a => a.id) },
                },
                data: {
                  isVerified: true,
                  verifiedAt: new Date(),
                  notes,
                },
              }),

              // Update checklist if all assets are now verified
              this.prisma.offboardingChecklist.updateMany({
                where: {
                  offboardingId,
                  task: 'Return Assigned Assets',
                },
                data: { status: 'COMPLETED' },
              }),
            ]);

            return { 
              success: true,
              message: `${returnedAssets.length} asset(s) approved`,
              assets: returnedAssets.map(a => a.asset.name),
            };
      }


      async getAllOffboarding() {
        return await this.prisma.offboarding.findMany({
          include: {
            user: {
              include: {
                assignments: true,
              },
            },
            checklist: true,
            uploads: true,
          },
        });
      }
}
