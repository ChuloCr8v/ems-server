import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DebtPaymentDto, InitiateExit, ReturnAsset } from './dto/offboarding.dto';
import { UserService } from 'src/user/user.service';
import { Status } from '@prisma/client';
import { bad } from 'src/utils/error.utils';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { MailService } from 'src/mail/mail.service';
import { UploadValidationUtil } from 'src/utils/uploads.utils';

@Injectable()
export class OffboardingService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly user: UserService,
        private readonly mail: MailService,
    ) {}

    async initiateExit(userId: string, data: InitiateExit, uploads: Express.Multer.File[]) {
      const { type, reason, lastWorkDate, noticePeriod } = data;

      try {
        // Verify user is ACTIVE
        const user = await this.user.__findUserById(userId);
        if (user.status !== Status.ACTIVE) {
          throw new BadRequestException('User is not active');
        }

        // Create offboarding record
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

        // Handle file uploads (if any)
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

          //Send Offboarding Email
          await this.mail.initiateOffboardingMail({
            email: exit.user.email,
            name: `${exit.user.firstName} ${exit.user.lastName}`.trim(),
          });

        return { exit };
      } catch (error)  {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to process debt payment');
      }
    }

    async returnAsset(assetId: string, data: ReturnAsset) {
      const { condition, reason } = data;
      
      try {
        return await this.prisma.$transaction(async (tx) => {
          // Find asset with assignments
          const asset = await tx.asset.findUnique({
            where: { id: assetId },
            include: {
              assignments: {
                include: {
                  offboarding: true,
                  user: true,
                },
                where: {
                  returnedAt: null,
                },
              },
            },
          });

          if (!asset) {
            throw new NotFoundException('Asset Not Found');
          }

          // Check if asset is already RETURNED
          if (asset.status === 'RETURNED') {
            throw new ConflictException('Asset Has Already Been Returned');
          }

          // Check if asset has active assignments
          if (!asset.assignments.length) {
            throw new BadRequestException('Asset is not currently assigned to anyone');
          }

          // Update the Asset
          const updatedAsset = await tx.asset.update({
            where: { id: assetId },
            data: {
              isReturned: true,
              status: 'RETURNED',
            },
          });

          // Update multiple active assignments if needed
          await tx.assignment.updateMany({
            where: { 
              assetId,
              returnedAt: null, // Only update active assignments
            },
            data: {
              condition,
              notes: reason,
              returnedAt: new Date(),
              offboardingId: asset.assignments[0].offboardingId,
            },
          });

          return updatedAsset;
        });
      } catch (error) {
        if (
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException
        ) {
          throw error;
        }
        console.error('Failed to return asset:', error);
        throw new BadRequestException('Failed to return asset');
      }
    }

    async checkAllAssetReturned(offboardingId: string) {
      try {
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
          data: { status: 'IN_PROGRESS'},
        });
        return { success: true, message: 'All Assigned Assets Have Been Returned '};
      }
        return { success: false, message: `${pendingAssets} asset(s) pending return`};
      } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to process debt payment');
      }
    
    }

    async approveAllReturnedAssets(offboardingId: string, notes?: string) {
      try {
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
      } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to process debt payment');
      }

    }

    async commentOffboardingAsset(assignmentId: string, comments: string, user: IAuthUser, uploads: Express.Multer.File[]) {
      try {
          //Verify that Assignment Exist And Assets has been returned
          const assignment = await this.prisma.assignment.findUnique({
            where: { id: assignmentId },
            include: { asset: true, offboarding: true },
          });

          if(!assignment) {
            throw bad("Assignment Not Found");
          }
          if(!assignment.returnedAt) {
            throw bad("Asset Not Returned Yet");
          }
          if(assignment.isVerified) {
            throw bad("Asset Is Already Verified");
          }

          //Create Comment and Uploads (Optional)
          return await this.prisma.$transaction(async (tx) => {
          const comment = await tx.comment.create({
            data: {
              comment: comments,
              userId: user.sub,
              assignmentId: assignment.id,
              offboardingId: assignment.offboardingId
            },
            include: { uploads: true }
          });
          //Handle Uploads
          if(uploads?.length > 0) {
            const assetUploads = uploads.map((upload) => ({
              name: upload.originalname,
              size: upload.size,
              type: upload.mimetype,
              bytes: upload.buffer,
              assignmentId: assignmentId,
              offboardingId: assignment.offboardingId,
            }));

            await this.prisma.upload.createMany({
              data: assetUploads,
            });
          }

          return { comment, };
        });
      } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to process asset debt payment');
      }
      
    }

    async assetPaymentReceipt(assignmentId: string, uploads: Express.Multer.File[], notes?: string) {
      const assignment = await this.prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: { asset: true },
      });
      if(!assignment){
        throw bad("Assignment Not Found");
      }
      if(assignment.asset.status !== 'REPORTED' && assignment.asset.status !== 'FAULTY') {
        throw bad("Asset must be REPORTED or FAULTY");
      }

      const receipt = uploads.map((upload) => ({
        name: upload.originalname,
        size: upload.size,
        type: upload.mimetype,
        bytes: upload.buffer,
        assignmentId: assignment.id,
      }));
      await this.prisma.upload.createMany({
        data: receipt,
      });

      const updatedAssignment = await this.prisma.assignment.update({
        where: { id: assignmentId },
        data: {
          notes: notes,
          isVerified: false,
        }
      });
      return { updatedAssignment, receipt };
      }

    async approveAssetPayment(assignmentId: string) {
        const assignment = await this.prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: { asset: true, uploads: true },
          });
        if(!assignment){
          throw bad("Assignment Record Not Found");
        }
        if (assignment.uploads.length === 0) {
          throw bad("No payment receipt uploaded")
        }
        return this.prisma.$transaction([
        // Update assignment status
        this.prisma.assignment.update({
          where: { id: assignmentId },
          data: {
            isPaid: true,
          },
        }),

        // Update asset status if approved
        ...(assignment.isPaid
          ? [
              this.prisma.asset.update({
                where: { id: assignment.assetId },
                data: { status: 'MAINTENANCE' },
              }),
            ]
          : []),
  ]);
    }

    async submitHandover(
      offboardingId: string,
      file: Express.Multer.File,
      notes?: string
    ) {
        const offboarding = await this.prisma.offboarding.findUnique({
        where: { id: offboardingId },
        include: { handover: true },
        });
            if(!offboarding) {
            throw new NotFoundException('Offboarding record not found');
            }

      return this.prisma.$transaction(async (prisma) => {
        // Create upload record
        const upload = await prisma.upload.create({
          data: {
            name: file.originalname,
            size: file.size,
            type: file.mimetype,
            bytes: file.buffer,
            offboardingId,
          },
        });

        // Create or update handover document
        return prisma.handoverDocument.upsert({
          where: { id: offboarding.id },
          create: {
            offboardingId,
            upload: { connect: { id: upload.id } },
            notes,
          },
          update: {
            upload: { connect: { id: upload.id } },
            notes,
            isApproved: false, // Reset approval if re-uploading
            approvedAt: null,
          },
          include: { upload: true },
        });
      });
    }

    async commentHandover(handoverId: string, comment: string, user: IAuthUser, uploads: Express.Multer.File[]) {
      try {
        //Verify Handover Exist
        const handover = await this.prisma.handoverDocument.findUnique({
          where: { id: handoverId },
          include: {
            offboarding: {
              include: { user: true },
            },
          },
        });
        if(!handover) {
          throw bad("Handover Document Not Found");
        }
        if(handover.isApproved) {
          throw bad("Handover Document Already Approved");
        }
        //Create Comment
        const commentRecord = await this.prisma.comment.create({
          data: {
            comment,
            userId: user.sub,
            handoverId: handover.id,
            offboardingId: handover.offboardingId,
          },
          include: { uploads: true },
        });

        if(uploads?.length > 0) {
          const handoverUploads = uploads.map((upload) => ({
            name: upload.originalname,
            size: upload.size,
            type: upload.mimetype,
            bytes: upload.buffer,
            handoverId: handoverId,
            commentId: commentRecord.id,
          }));

          await this.prisma.upload.createMany({
            data: handoverUploads,
          });
        }
        return commentRecord;
        
      } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to comment on handover');
      }
    }

    async approveHandoverSub(handoverId: string, user: IAuthUser) {
      const handover = await this.prisma.handoverDocument.findUnique({
        where: { id: handoverId },
        include: {
          offboarding: {
            include: {
              user: {
                include: {
                  department: true
                },
              },
            },
          },
        },
      });
      if(!handover) {
        throw bad("Handover Document Not Found");
      }

      //Verify manager is from the same department
      const manager = await this.prisma.user.findUnique({
        where: { id: user.sub },
        include: { department: true }
      });

        if (!manager) {
          throw bad('Manager not found');
        }

        if (manager.departmentId !== handover.offboarding.user.departmentId) {
          throw bad("Only managers from the same department can approve handovers");
        }

        //Approve handover submission
        return this.prisma.handoverDocument.update({
        where: { id: handoverId },
        data: {
          isApproved: true,
          approvedAt: new Date(),
        },
        include: {
          offboarding: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  department: true
                }
              }
            }
          },
          upload: true
        }
      });

    }

    async deptPayment(
      offboardingId: string,
      uploads: Express.Multer.File[],
      user: IAuthUser,
      dto: DebtPaymentDto,
    ) {
      const { notes } = dto;

      //Validate uploads
      UploadValidationUtil.validateFiles(uploads, {
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        maxFileSize: 10 * 1024 * 1024,
      });
      
       try {
         // Validate offboarding exists and belongs to user
          const offboarding = await this.prisma.offboarding.findUnique({
            where: { 
              id: offboardingId, 
              userId: user.sub 
            },
            include: {
              user: true,
              payments: {
                where: {
                  approved: false, // Only consider pending payments
                }
              },
            }
          });

           if (!offboarding) {
             throw bad('Offboarding record not found');
          }

          //Check for unapproved payment
          if (offboarding.payments.length > 0) {
            throw bad('There is already a pending payment for this offboarding');
          }

          //Create Payment Record
          const payment = await this.prisma.payment.create({
            data: {
              notes,
              offboardingId: offboardingId,
            },
            include: { uploads: true}
          });

          //Create Upload Records
          if(uploads?.length > 0) {
            const paymentUploads = uploads.map((upload) => ({
              name: upload.originalname,
              size: upload.size,
              type: upload.mimetype,
              bytes: upload.buffer,
              paymentId: payment.id,
              offboardingId: offboarding.id,
              userId: user.sub,
            }));

            await this.prisma.upload.createMany({
              data: paymentUploads,
            });

            return paymentUploads
          }
          return payment;

       } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to process debt payment');
      }
    }

    async commentdebtPayment(paymentId: string, comment: string, user: IAuthUser, uploads: Express.Multer.File[]) {
      try {
        //Verify Payment Exists
        const payment = await this.prisma.payment.findUnique({
          where: { id: paymentId },
          include: {
            offboarding: {
              include: { user: true, }
            },
          },
        });

        if(!payment) {
          throw bad("Payment Record Not Found");
        }
        if(payment.approved) {
          throw bad("Payment Already Approved");
        }

        //Create Comment
        const comments =  await this.prisma.comment.create({
          data: {
            comment,
            userId: user.sub,
            paymentId: payment.id,
            offboardingId: payment.offboardingId,
          }, 
          include: { uploads: true },
        });

        if(uploads?.length > 0) {
          const paymentUploads = uploads.map((upload) => ({
            name: upload.originalname,
            size: upload.size,
            type: upload.mimetype,
            bytes: upload.buffer,
            paymentId: paymentId,
            commentId: comments.id,
          }));

          await this.prisma.upload.createMany({
            data: paymentUploads,
          });
        }
        return comments;
        
      } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to process debt payment');
      }
    }

    async approveDebtPayment(paymentId: string, admin: IAuthUser) {
      try {
          const payment = await this.prisma.payment.findUnique({
          where: { id: paymentId },
          include: {
            offboarding: true,
          },
        });

        if (!payment) throw new NotFoundException('Payment not found');

        return this.prisma.$transaction([
          this.prisma.payment.update({
            where: { id: paymentId },
            data: {
              approved: true,
              approvedBy: admin.sub,
              approvedAt: new Date(),
            },
          }),

          // Update checklist after payment has been approved
              this.prisma.offboardingChecklist.updateMany({
                where: {
                  offboardingId: payment.offboardingId,
                  task: "Upload Proof of Payment (if applicable)",
                },
                data: { status: 'COMPLETED' },
              }),
        ]);
      } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to process debt payment');
      }
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
