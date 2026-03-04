import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
// import { CommentsDto, DebtPaymentDto, HandoverDto, HandoverDto, InitiateExit, NotesDto, OffboardingCommentsDto, ReturnAsset } from './dto/offboarding.dto';
import { UserService } from 'src/user/user.service';
import { Role, Status } from '@prisma/client';
import { bad } from 'src/utils/error.utils';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { MailService } from 'src/mail/mail.service';
import { UploadValidationUtil } from 'src/utils/uploads.utils';
import { InitiateExit } from './dto/offboarding.dto';

@Injectable()
export class OffboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly user: UserService,
    private readonly mail: MailService,
  ) { }

  async initiateExit(userId: string, data: InitiateExit) {
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
                { task: "Sign and Fill HR Clearance Form" },
                { task: "Upload Proof of Payment (if applicable)" },
                { task: "Sign and Fill Facility Clearance Form"},
                { task: "Return Assigned Assets" },
                { task: "Submit Handover Form" },
              ]
            }
          },
          uploads: data.uploads
          ? {
            connect: data.uploads.map((id) => ({ id })),
          }
          : undefined,
        },
        include: {
          user: true,
        },
      });

      //Send Offboarding Email
      await this.mail.initiateOffboardingMail({
        email: exit.user.email,
        name: `${exit.user.firstName} ${exit.user.lastName}`.trim(),
      });

      return { exit };
    } catch (error) {
        console.log(error);
        bad(`Failed to initiate offboarding: ${error.message}`);
    }
  }

  // async sendClearanceForm() {}

  // async returnAsset(assetId: string, data: ReturnAsset) {
  //   const { condition, reason } = data;

  //   try {
  //     return await this.prisma.$transaction(async (tx) => {
  //       // Find asset with assignments
  //       const asset = await tx.asset.findUnique({
  //         where: { id: assetId },
  //         include: {
  //           assignments: {
  //             include: {
  //               offboarding: true,
  //               user: true,
  //             },
  //             where: {
  //               returnedAt: null,
  //             },
  //           },
  //         },
  //       });

  //       if (!asset) {
  //         throw new NotFoundException('Asset Not Found');
  //       }

  //       // Check if asset is already RETURNED
  //       // if (asset.a === 'RETURNED') {
  //       //   throw new ConflictException('Asset Has Already Been Returned');
  //       // }

  //       // Check if asset has active assignments
  //       // if (!asset.assignments.length) {
  //       //   throw new BadRequestException('Asset is not currently assigned to anyone');
  //       // }

  //       // Update the Asset
  //       const updatedAsset = await tx.asset.update({
  //         where: { id: assetId },
  //         data: {
  //           isReturned: true,
  //         },
  //       });

  //       // Update multiple active assignments if needed
  //       await tx.assignment.updateMany({
  //         where: {
  //           assetId,
  //           returnedAt: null, // Only update active assignments
  //         },
  //         data: {
  //           condition,
  //           notes: reason,
  //           returnedAt: new Date(),
  //           offboardingId: asset.assignments[0].offboardingId,
  //         },
  //       });

  //       return updatedAsset;
  //     });
  //   } catch (error) {
  //       console.log(error);
  //        bad(`Failed to return asset: ${error.message}`);
  //   }
  // }

  // async checkAllAssetReturned(offboardingId: string) {
  //   try {
  //     const offboarding = await this.prisma.offboarding.findUnique({
  //       where: { id: offboardingId },
  //       include: { user: true },
  //     });
  //     if (!offboarding) {
  //       throw new NotFoundException('Offboarding record not found');
  //     }

  //     //Check if all assets are returned
  //     const pendingAssets = await this.prisma.asset.count({
  //       where: {
  //         assignments: { some: { userId: offboarding.userId } },
  //         isReturned: false,
  //       },
  //     });

  //     //Update checklist if all returned
  //     if (pendingAssets === 0) {
  //       await this.prisma.offboardingChecklist.updateMany({
  //         where: {
  //           offboardingId,
  //           task: 'Return Assigned Assets',
  //         },
  //         data: { status: 'IN_PROGRESS' },
  //       });
  //       return { success: true, message: 'All Assigned Assets Have Been Returned ' };
  //     }
  //     return { success: false, message: `${pendingAssets} asset(s) pending return` };
  //   } catch (error) {
  //     if (error instanceof BadRequestException ||
  //       error instanceof NotFoundException ||
  //       error instanceof ConflictException) {
  //       throw error;
  //     }
  //     throw new BadRequestException('Failed to process debt payment');
  //   }

  // }

  // async approveAllReturnedAssets(offboardingId: string, notes?: string) {
  //   try {
  //     //Get offboarding record with user info
  //     const offboarding = await this.prisma.offboarding.findUnique({
  //       where: { id: offboardingId },
  //       include: { user: true },
  //     });

  //     if (!offboarding) {
  //       throw new NotFoundException('Offboarding record not found');
  //     }

  //     //Get all RETURNED but UNVERIFIED assets
  //     const returnedAssets = await this.prisma.assignment.findMany({
  //       where: {
  //         userId: offboarding.userId,
  //         asset: { isReturned: true },
  //         isVerified: false,
  //       },
  //       include: { asset: true },
  //     });

  //     if (returnedAssets.length === 0) {
  //       throw new BadRequestException('No pending assets to approve');
  //     }

  //     //Bulk update verification status
  //     await this.prisma.$transaction([
  //       // Update all assignments
  //       this.prisma.assignment.updateMany({
  //         where: {
  //           id: { in: returnedAssets.map(a => a.id) },
  //         },
  //         data: {
  //           isVerified: true,
  //           verifiedAt: new Date(),
  //           notes,
  //         },
  //       }),

  //       // Update checklist if all assets are now verified
  //       this.prisma.offboardingChecklist.updateMany({
  //         where: {
  //           offboardingId,
  //           task: 'Return Assigned Assets',
  //         },
  //         data: { status: 'COMPLETED' },
  //       }),
  //     ]);

  //     return {
  //       success: true,
  //       message: `${returnedAssets.length} asset(s) approved`,
  //       assets: returnedAssets.map(a => a.asset.name),
  //     };
  //   } catch (error) {
  //     if (error instanceof BadRequestException ||
  //       error instanceof NotFoundException ||
  //       error instanceof ConflictException) {
  //       throw error;
  //     }
  //     throw new BadRequestException('Failed to process debt payment');
  //   }

  // }

  // async commentOffboardingAsset(assignmentId: string, userId: string, data: CommentsDto) {
  //   try {
  //     const user = await this.findUserById(userId);
  //       if (!user) {
  //           throw bad("User Not Found")
  //       }
  //     //Verify that Assignment Exist And Assets has been returned
  //     const assignment = await this.prisma.assignment.findUnique({
  //       where: { id: assignmentId },
  //       include: { asset: true, offboarding: true },
  //     });

  //     if (!assignment) {
  //       throw bad("Assignment Not Found");
  //     }
  //     if (!assignment.returnedAt) {
  //       throw bad("Asset Not Returned Yet");
  //     }
  //     if (assignment.isVerified) {
  //       throw bad("Asset Is Already Verified");
  //     }

  //     //Create Comment and Uploads (Optional)
  //     return await this.prisma.$transaction(async (tx) => {
  //       const comment = await tx.comment.create({
  //         data: {
  //           comment: data.comments,
  //           userId: user.id,
  //           // assignmentId: assignment.id,
  //           offboardingId: assignment.offboardingId,
  //           uploads: data.uploads
  //           ? {
  //             connect: data.uploads.map((id) => ({ id })),
  //           }
  //           : undefined,
  //         },
  //         include: { uploads: true }
  //       });

  //       return { comment, };
  //     });
  //   } catch (error) {
  //     if (error instanceof BadRequestException ||
  //       error instanceof NotFoundException ||
  //       error instanceof ConflictException) {
  //       throw error;
  //     }
  //     throw new BadRequestException('Failed to process asset debt payment');
  //   }

  // }

  // async assetPaymentReceipt(assignmentId: string, data: NotesDto) {
  //   const assignment = await this.prisma.assignment.findUnique({
  //     where: { id: assignmentId },
  //     include: { asset: true },
  //   });
  //   if (!assignment) {
  //     throw bad("Assignment Not Found");
  //   }
  //   if (assignment.asset.status !== 'REPORTED' && assignment.asset.status !== 'FAULTY') {
  //     throw bad("Asset must be REPORTED or FAULTY");
  //   }

  //   const updatedAssignment = await this.prisma.assignment.update({
  //     where: { id: assignmentId },
  //     data: {
  //       notes: data.notes,
  //       isVerified: false,
  //       asset: {
  //         update: {
  //           assetImages:  data.uploads
  //             ? {
  //               connect: data.uploads.map((id) => ({ id })),
  //             }
  //             : undefined,
  //             }
  //       }
  //     }
  //   });
  //   return { updatedAssignment, receipt: data. uploads };
  // }

  // async approveAssetPayment(assignmentId: string) {
  //   const assignment = await this.prisma.assignment.findUnique({
  //     where: { id: assignmentId },
  //     include: { asset: true, },
  //   });

  //   if (!assignment) {
  //     throw bad("Assignment Record Not Found");
  //   }

  //   return this.prisma.$transaction([
  //     // Update assignment status
  //     this.prisma.assignment.update({
  //       where: { id: assignmentId },
  //       data: {
  //         isPaid: true,
  //       },
  //     }),

  //     // Update asset status if approved
  //     ...(assignment.isPaid
  //       ? [
  //         this.prisma.asset.update({
  //           where: { id: assignment.assetId },
  //           data: { status: 'MAINTENANCE' },
  //         }),
  //       ]
  //       : []),
  //   ]);
  // }

  // async submitHandover(offboardingId: string, data: HandoverDto) {
  //   const offboarding = await this.prisma.offboarding.findUnique({
  //     where: { id: offboardingId },
  //     include: { handover: true },
  //   });
  //   if (!offboarding) {
  //     throw new NotFoundException('Offboarding record not found');
  //   }

  //   return this.prisma.$transaction(async (prisma) => {

  //     // Create or update handover document
  //     return prisma.handoverDocument.upsert({
  //       where: { id: offboarding.id },
  //       create: {
  //         offboardingId,
  //         upload: data.uploads
  //           ? {
  //             connect: data.uploads.map((id) => ({ id })),
  //           }
  //           : undefined,
  //         notes: data.notes,
  //       },
  //       update: {
  //         // upload: { connect: { id: upload.id } },
  //         upload: data.uploads
  //           ? {
  //             connect: data.uploads.map((id) => ({ id })),
  //           }
  //           : undefined,
  //         notes: data.notes,
  //         isApproved: false, // Reset approval if re-uploading
  //         approvedAt: null,
  //       },
  //       include: { upload: true },
  //     });
  //   });
  // }

  // async commentHandover(handoverId: string, userId: string, data: CommentsDto) {
  //   try {
  //      const user = await this.findUserById(userId);
  //         if (!user) {
  //             throw bad("User Not Found")
  //         }
  //     //Verify Handover Exist
  //     const handover = await this.prisma.handoverDocument.findUnique({
  //       where: { id: handoverId },
  //       include: {
  //         offboarding: {
  //           include: { user: true },
  //         },
  //       },
  //     });
  //     if (!handover) {
  //       throw bad("Handover Document Not Found");
  //     }
  //     if (handover.isApproved) {
  //       throw bad("Handover Document Already Approved");
  //     }
  //     //Create Comment
  //     const commentRecord = await this.prisma.comment.create({
  //       data: {
  //         comment: data.comments,
  //         userId: user.id,
  //         handoverId: handover.id,
  //         offboardingId: handover.offboardingId,
  //         uploads: data.uploads
  //           ? {
  //             connect: data.uploads.map((id) => ({ id })),
  //           }
  //           : undefined,
  //       },
  //       include: { uploads: true },
  //     });
      
  //     return commentRecord;

  //   } catch (error) {
  //     if (error instanceof BadRequestException ||
  //       error instanceof NotFoundException ||
  //       error instanceof ConflictException) {
  //       throw error;
  //     }
  //     throw new BadRequestException('Failed to comment on handover');
  //   }
  // }

  // async approveHandoverSub(handoverId: string, userId: string) {
  //    const user = await this.findUserById(userId);
  //       if (!user) {
  //           throw bad("User Not Found")
  //       }
  //   const handover = await this.prisma.handoverDocument.findUnique({
  //     where: { id: handoverId },
  //     include: {
  //       offboarding: {
  //         include: {
  //           user: {
  //             include: {
  //               departments: true
  //             },
  //           },
  //         },
  //       },
  //     },
  //   });
  //   if (!handover) {
  //     throw bad("Handover Document Not Found");
  //   }

  //   //Verify manager is from the same department
  //   const manager = await this.prisma.user.findUnique({
  //     where: { id: user.id },
  //     include: { departments: true }
  //   });

  //   if (!manager) {
  //     throw bad('Manager not found');
  //   }

  //   // if (manager.departmentId !== handover.offboarding.user.departmentId) {
  //   //   throw bad("Only managers from the same department can approve handovers");
  //   // }

  //   //Approve handover submission
  //   return this.prisma.handoverDocument.update({
  //     where: { id: handoverId },
  //     data: {
  //       isApproved: true,
  //       approvedAt: new Date(),
  //     },
  //     include: {
  //       offboarding: {
  //         include: {
  //           user: {
  //             select: {
  //               firstName: true,
  //               lastName: true,
  //               email: true,
  //               departments: true
  //             }
  //           }
  //         }
  //       },
  //       upload: true
  //     }
  //   });

  // }

  // async deptPayment(
  //   offboardingId: string,
  //   userId: string,
  //   data: DebtPaymentDto,
  // ) {
  //   // const { notes } = dto;

  //   try {
  //      const user = await this.findUserById(userId);
  //                 if (!user) {
  //                     throw bad("User Not Found")
  //                 }
  //     // Validate offboarding exists and belongs to user
  //     const offboarding = await this.prisma.offboarding.findUnique({
  //       where: {
  //         id: offboardingId,
  //         userId: user.id,
  //       },
  //       include: {
  //         user: true,
  //         payments: {
  //           where: {
  //             approved: false, // Only consider pending payments
  //           }
  //         },
  //       }
  //     });

  //     if (!offboarding) {
  //       throw bad('Offboarding record not found');
  //     }

  //     //Check for unapproved payment
  //     if (offboarding.payments.length > 0) {
  //       throw bad('There is already a pending payment for this offboarding');
  //     }

  //     //Create Payment Record
  //     const payment = await this.prisma.payment.create({
  //       data: {
  //         notes: data.notes,
  //         offboardingId: offboardingId,
  //         uploads: data.uploads
  //           ? {
  //               connect: data.uploads.map((id) => ({ id })),
  //             }
  //           : undefined,
  //       },
  //       include: { uploads: true }
  //     });
  
  //     return payment;

  //   } catch (error) {
  //     if (error instanceof BadRequestException ||
  //       error instanceof NotFoundException ||
  //       error instanceof ConflictException) {
  //       throw error;
  //     }
  //     throw new BadRequestException('Failed to process debt payment');
  //   }
  // }

  // async commentdebtPayment(paymentId: string, userId: string, data: CommentsDto) {
  //   try {
  //      const user = await this.findUserById(userId);
  //         if (!user) {
  //             throw bad("User Not Found")
  //         }
  //     //Verify Payment Exists
  //     const payment = await this.prisma.payment.findUnique({
  //       where: { id: paymentId },
  //       include: {
  //         offboarding: {
  //           include: { user: true, }
  //         },
  //       },
  //     });

  //     if (!payment) {
  //       throw bad("Payment Record Not Found");
  //     }
  //     if (payment.approved) {
  //       throw bad("Payment Already Approved");
  //     }

  //     //Create Comment
  //     const comments = await this.prisma.comment.create({
  //       data: {
  //         comment: data.comments,
  //         userId: user.id,
  //         paymentId: payment.id,
  //         offboardingId: payment.offboardingId,
  //         uploads: data.uploads
  //         ? {
  //           connect: data.uploads.map((id) => ({ id })),
  //         }
  //         : undefined,
  //       },
  //       include: { uploads: true },
  //     });

  //     return comments;

  //   } catch (error) {
  //     if (error instanceof BadRequestException ||
  //       error instanceof NotFoundException ||
  //       error instanceof ConflictException) {
  //       throw error;
  //     }
  //     throw new BadRequestException('Failed to process debt payment');
  //   }
  // }

  // async approveDebtPayment(paymentId: string, userId: string) {
  //   try {
  //      const user = await this.findUserById(userId);
  //         if (!user) {
  //             throw bad("User Not Found")
  //         }
  //         const isAdmin = this.userHasRole(user, Role.ADMIN);
  //         if(!isAdmin) throw bad("Only Admins Can Approve Debt Payments")
  //     const payment = await this.prisma.payment.findUnique({
  //       where: { id: paymentId },
  //       include: {
  //         offboarding: true,
  //       },
  //     });

  //     if (!payment) throw new NotFoundException('Payment not found');

  //     return this.prisma.$transaction([
  //       this.prisma.payment.update({
  //         where: { id: paymentId },
  //         data: {
  //           approved: true,
  //           approvedBy: user.id,
  //           approvedAt: new Date(),
  //         },
  //       }),

  //       // Update checklist after payment has been approved
  //       this.prisma.offboardingChecklist.updateMany({
  //         where: {
  //           offboardingId: payment.offboardingId,
  //           task: "Upload Proof of Payment (if applicable)",
  //         },
  //         data: { status: 'COMPLETED' },
  //       }),
  //     ]);
  //   } catch (error) {
  //     if (error instanceof BadRequestException ||
  //       error instanceof NotFoundException ||
  //       error instanceof ConflictException) {
  //       throw error;
  //     }
  //     throw new BadRequestException('Failed to process debt payment');
  //   }
  // }

  // async getAllOffboarding() {
  //   return await this.prisma.offboarding.findMany({
  //     include: {
  //       user: {
  //         include: {
  //           assignments: true,
  //         },
  //       },
  //       checklist: true,
  //       uploads: true,
  //     },
  //   });
  // }


  // ///////////////////////// HELPERS //////////////////////////////
  //     private async findUserById(userId: string) {
  //         try {
  //             const user = await this.prisma.user.findUnique({
  //                 where: { id: userId },
  //                 include: { departments: true, approver: true, },
  //             });
  //             return user;
  //         } catch (error) {
  //             console.log(error);
  //             bad(`Failed to get user: ${error.message}`);
  //         }
  //     }
  
  //     private userHasRole(userObj: any, role: Role) {
  //         if (!userObj) return false;
  //         // userObj.userRole may be an array of Role or a single Role string
  //         const roles = (userObj.userRole ?? userObj.role) as any;
  //         if (Array.isArray(roles)) return roles.includes(role);
  //         return roles === role;
  //     }

}