import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimStatus, Prisma, Role } from '@prisma/client';
import { CreateClaimDto, UpdateClaimDto } from './dto/claims.dto';
import { bad, mustHave } from 'src/utils/error.utils';
import { MailService } from 'src/mail/mail.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClaimApprovedEvent, ClaimCreatedEvent, ClaimPaidEvent, ClaimRejectedEvent } from 'src/events/claim.event';
import { PaystackService } from 'src/payment/paystack.service';

@Injectable()
export class ClaimsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private event: EventEmitter2,
    private paystack: PaystackService,
  ) { }

  async addClaim(userId: string, createClaimDto: CreateClaimDto) {
    try {
      const claimId = 'CLM' + Date.now().toString().slice(-4);

      const claim = await this.prisma.claim.create({
        data: {
          claimId,
          title: createClaimDto.title,
          amount: Number(createClaimDto.amount),
          dateOfExpense: new Date(createClaimDto.dateOfExpense),
          description: createClaimDto.description,
          entitlement: { connect: { id: createClaimDto.entitlement } },
          user: {
            connect: {
              id: userId,
            },
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

      const emailReciepients = await this.prisma.user.findMany({
        where: {
          userRole: {
            hasSome: ['ADMIN', 'SUPERADMIN'],
          },
        },
      });

      if (emailReciepients.length) {
        this.event.emit(
          'claim.created',
          new ClaimCreatedEvent(
            claim.id,
            userId,
            emailReciepients.map((e) => e.id),
          ),
        );

        await Promise.all(
          emailReciepients.map((e) =>
            this.mail.sendNewClaimMail({
              email: e.email,
              approverName: e.firstName + ' ' + e.lastName,
              name: `${claim.user.firstName} ${claim.user.lastName}`,
              claimTitle: createClaimDto.title,
              type: createClaimDto.entitlement,
              amount: createClaimDto.amount.toLocaleString(),
              date: createClaimDto.dateOfExpense,
              description:
                createClaimDto.description || 'No description provided',
            }),
          ),
        );
      }

      return claim;
    } catch (error) {
      bad(error);
    }
  }




  // async findAll(
  //   userId: string,
  //   userRole: Role[],
  //   filters: { status?: ClaimStatus }
  // ) {
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //     include: { approver: true },
  //   });

  //   const approverDepartmentIds =
  //     user?.approver?.map((d) => d.departmentId) ?? [];

  //   const baseWhere: Prisma.ClaimWhereInput = {
  //     ...(filters.status && { status: filters.status }),
  //   };

  //   const claims = await this.prisma.claim.findMany({
  //     where: baseWhere,
  //     include: {
  //       user: {
  //         select: {
  //           id: true,
  //           firstName: true,
  //           lastName: true,
  //           email: true,
  //           departments: true,
  //         },
  //       },
  //       proofUrls: true,
  //       entitlement: true,
  //       comments: {
  //         include: {
  //           user: true
  //         }
  //       }
  //     },
  //     orderBy: { createdAt: "desc" },
  //   });

  //   type ClaimWithUserAndProof = typeof claims[number];

  //   let res: ClaimWithUserAndProof[] = [];

  //   if (userRole.includes(Role.ADMIN)) {
  //     res = claims;
  //   } else if (userRole.includes(Role.DEPT_MANAGER) && approverDepartmentIds.length) {
  //     res = claims.filter((claim) =>
  //       claim.user.departments.some((dept) =>
  //         approverDepartmentIds.includes(dept.id)
  //       )
  //     );
  //   } else {
  //     res = claims.filter((claim) => claim.userId === userId);
  //   }

  //   return res;
  // }



  // async findOne(id: string) {
  //   const claim = await this.prisma.claim.findUnique({
  //     where: { id },
  //     include: {
  //       user: {
  //         select: {
  //           id: true,
  //           firstName: true,
  //           lastName: true,
  //           email: true,
  //         },
  //       },
  //       proofUrls: true,
  //       entitlement: true,
  //       comments: {
  //         include: {
  //           user: true
  //         }
  //       }
  //     },
  //   });

  //   if (!claim) {
  //     throw new NotFoundException('Claim not found');
  //   }

  //   return claim
  // }







  // For findOne method with bank:
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
            bank: true, // Add this if you need bank details
          },
        },
        proofUrls: true,
        entitlement: true,
        comments: {
          include: {
            user: true
          }
        },
        claimPayments: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    return claim
  }

  // For findAll method with bank:
  async findAll(
    userId: string,
    userRole: Role[],
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
            bank: true, // Add this if you need bank details
          },
        },
        proofUrls: true,
        entitlement: true,
        comments: {
          include: {
            user: true
          }
        },
        claimPayments: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    type ClaimWithUserAndProof = typeof claims[number];

    let res: ClaimWithUserAndProof[] = [];

    if (userRole.includes(Role.ADMIN)) {
      res = claims;
    } else if (userRole.includes(Role.DEPT_MANAGER) && approverDepartmentIds.length) {
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

  async updateClaim(id: string, userRole: Role[], updateClaimDto: UpdateClaimDto) {
    console.log({ updateClaimDto })

    const claim = await this.findOne(id);

    if (!claim) mustHave(claim, 'Claim not found', 404);

    if (
      (!userRole.includes(Role.DEPT_MANAGER) ||
        !userRole.includes(Role.DEPT_MANAGER)) &&
      updateClaimDto.status
    ) {
      throw new ForbiddenException('Only managers can update claim status');
    }

    const updatedClaim = await this.prisma.claim.update({
      where: { id },
      data: {
        ...updateClaimDto,
        entitlement: {
          connect: {
            id: updateClaimDto.entitlement,
          },
        },
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

    return updatedClaim;
  }

  async removeClaim(id: string, userId: string, userRole: Role[]) {
    const claim = await this.findOne(id);

    if (userRole.includes(Role.USER) && claim.userId !== userId) {
      throw new ForbiddenException('You can only delete your own claims');
    }

    await this.prisma.claim.delete({
      where: { id },
    });

    return { message: 'Claim deleted successfully' };
  }

  async updateStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    approverId: string,
    notes?: string,
  ) {
    try {
      // 1. Find claim and include user
      const claim = await this.prisma.claim.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!claim) {
        throw new NotFoundException('Claim not found');
      }

      if (!claim.user) {
        throw new Error('Claim has no associated user');
      }

      // 2. Update claim
      const updatedClaim = await this.prisma.claim.update({
        where: { id },
        data: {
          status,
          notes: notes || undefined,
          updatedAt: new Date(),
        },
        include: { user: true },
      });

      // 3. Find approver safely
      let approverName = 'Admin';
      try {
        const approver = await this.prisma.user.findUnique({
          where: { id: approverId },
        });
        if (approver)
          approverName = `${approver.firstName} ${approver.lastName}`;
      } catch (error) {
        bad('Failed to find approver:', error);
      }

      // 4. Emit events and send emails asynchronously (won't block)
      const sendMailSafe = async (mailFunc: () => Promise<void>) => {
        try {
          await mailFunc();
        } catch (err) {
          bad('Failed to send email:', err);
        }
      };

      if (status === 'APPROVED') {
        this.event.emit(
          'claim.approved',
          new ClaimApprovedEvent(
            id,
            updatedClaim.userId,
            [updatedClaim.userId],
            approverId,
          ),
        );

        await sendMailSafe(() =>
          this.mail.sendClaimApprovalMail({
            email: updatedClaim.user.email,
            name: `${updatedClaim.user.firstName} ${updatedClaim.user.lastName}`,
            claimTitle: updatedClaim.title,
            amount: updatedClaim.amount.toLocaleString('en-US'),
            date: updatedClaim.dateOfExpense,
            approverName,
          }),
        );
      }

      if (status === 'REJECTED') {
        this.event.emit(
          'claim.rejected',
          new ClaimRejectedEvent(
            id,
            updatedClaim.userId,
            [updatedClaim.userId],
            approverId,
            notes,
          ),
        );

        await sendMailSafe(() =>
          this.mail.sendClaimRejectionMail({
            email: updatedClaim.user.email,
            name: `${updatedClaim.user.firstName} ${updatedClaim.user.lastName}`,
            claimTitle: updatedClaim.title,
            amount: updatedClaim.amount.toLocaleString('en-US'),
            date: updatedClaim.dateOfExpense,
            approverName,
            reason: notes,
          }),
        );
      }

      return updatedClaim;
    } catch (error) {
      console.error('Failed to update claim status:', error);
      throw new InternalServerErrorException(
        'Unable to update claim status',
        error,
      );
    }
  }

  async approveClaim(id: string) {
    const claim = await this.prisma.claim.findUnique({ where: { id } });
    if (!claim) throw new NotFoundException('Claim not found');

    return this.prisma.claim.update({
      where: { id },
      data: { status: ClaimStatus.APPROVED },
    });
  }

  async rejectClaim(id: string) {
    const claim = await this.prisma.claim.findUnique({ where: { id } });
    if (!claim) throw new NotFoundException('Claim not found');

    return this.prisma.claim.update({
      where: { id },
      data: { status: ClaimStatus.REJECTED },
    });
  }

  async comment(
    id: string,
    userId: string,
    dto: { comment: string; uploads?: string[] },
  ) {
    try {
      const claim = await this.prisma.claim.findUnique({
        where: {
          id,
        },
      });

      if (!claim) mustHave(claim, 'Task not found', 404);
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) mustHave(user, 'user not found', 404);

      const comment = await this.prisma.comment.create({
        data: {
          comment: dto.comment,
          ...(dto.uploads
            ? { uploads: { connect: dto.uploads.map((u) => ({ id: u })) } }
            : {}),
          claim: { connect: { id } },
          user: { connect: { id: userId } },
        },
      });
      return {
        message: 'Comment added successfully',
        data: comment,
      };
    } catch (error) {
      bad(error);
    }
  }

  async processPayment(id: string, paymentDetails: {
    bankCode: string;
    accountNumber: string;
    accountName?: string;
  }) {
    const claim = await this.prisma.claim.findUnique({
      where: { id },
      include: {
        user: true,
        claimPayments: true, // Check if payments already exist
      },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    if (claim.status !== ClaimStatus.APPROVED) {
      throw new BadRequestException('Only approved claims can be paid');
    }

    // Check if there's already a successful payment
    const successfulPayment = claim.claimPayments.find(p => p.status === 'SUCCESS');
    if (successfulPayment) {
      throw new BadRequestException('Payment has already been successfully processed for this claim');
    }

    try {
      // Prepare payment details for Paystack
      const paystackPaymentDetails = {
        amount: claim.amount,
        recipientEmail: claim.user.email,
        recipientName: paymentDetails.accountName || `${claim.user.firstName} ${claim.user.lastName}`,
        recipientBankCode: paymentDetails.bankCode,
        recipientAccountNumber: paymentDetails.accountNumber,
        narration: `Payment for claim: ${claim.title} (${claim.claimId})`,
        claimId: claim.id,
      };

      // Process payment through Paystack
      const paymentResult = await this.paystack.processPayment(paystackPaymentDetails);

      if (!paymentResult.success) {
        throw new BadRequestException(`Payment failed: ${paymentResult.message}`);
      }

      // Create ClaimPayment record (not Payment)
      const claimPayment = await this.prisma.claimPayment.create({
        data: {
          claim: { connect: { id } },
          amount: claim.amount,
          recipientName: paystackPaymentDetails.recipientName,
          recipientAccountNumber: paymentDetails.accountNumber,
          recipientBankCode: paymentDetails.bankCode,
          transferReference: paymentResult.transferReference,
          recipientCode: paymentResult.recipientCode,
          status: 'PENDING', // Will be updated via webhook
          paymentMethod: 'PAYSTACK',
          processedAt: new Date(),
        },
      });

      // Update claim status to PAID
      const updatedClaim = await this.prisma.claim.update({
        where: { id },
        data: {
          status: ClaimStatus.PAID,
          updatedAt: new Date(),
        },
        include: {
          user: true,
          claimPayments: true,
        },
      });

      // Emit payment event
      this.event.emit('claim.paid', new ClaimPaidEvent(
        claim.id,
        claim.userId,
        [claim.userId],
        paymentResult.transferReference,
        claim.amount
      ));

      // Send payment confirmation email
      await this.mail.sendPaymentConfirmationMail({
        email: claim.user.email,
        name: `${claim.user.firstName} ${claim.user.lastName}`,
        claimTitle: claim.title,
        amount: claim.amount.toLocaleString(),
        paymentReference: paymentResult.transferReference,
        date: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Payment processed successfully',
        claim: updatedClaim,
        claimPayment: claimPayment,
        transferReference: paymentResult.transferReference,
      };
    } catch (error) {
      // Create PaymentAttempt record
      await this.prisma.paymentAttempt.create({
        data: {
          claim: { connect: { id } },
          amount: claim.amount,
          error: error.message,
          attemptedAt: new Date(),
        },
      });

      throw new BadRequestException(`Payment processing failed: ${error.message}`);
    }
  }

  // In src/claims/claims.service.ts, add these methods:

  async findByTransferReference(transferReference: string) {
    return this.prisma.claim.findFirst({
      where: {
        claimPayments: {
          some: {
            transferReference,
          },
        },
      },
      include: {
        user: true,
        claimPayments: {
          where: {
            transferReference,
          },
        },
      },
    });
  }

  async updatePaymentStatus(
    claimId: string,
    status: 'SUCCESS' | 'FAILED' | 'REVERSED',
    additionalData?: {
      verifiedAt?: Date;
      failureReason?: string;
      reversalReason?: string;
      paystackData?: any;
    }
  ) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
      include: { claimPayments: true },
    });

    if (!claim || !claim.claimPayments.length) {
      throw new NotFoundException('Claim or payment not found');
    }

    // Get the latest payment
    const latestPayment = claim.claimPayments[claim.claimPayments.length - 1];

    const updateData: any = {
      status,
      verifiedAt: additionalData?.verifiedAt || new Date(),
    };

    if (status === 'FAILED' && additionalData?.failureReason) {
      updateData.failureReason = additionalData.failureReason;
    }

    if (status === 'REVERSED' && additionalData?.reversalReason) {
      updateData.reversalReason = additionalData.reversalReason;
    }

    if (additionalData?.paystackData) {
      updateData.paystackData = additionalData.paystackData;
    }

    return this.prisma.claimPayment.update({
      where: { id: latestPayment.id },
      data: updateData,
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
