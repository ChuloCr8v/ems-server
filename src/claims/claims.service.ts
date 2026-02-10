// src/claims/claims.service.ts
import { 
  Injectable, 
  NotFoundException, 
  ForbiddenException, 
  BadRequestException, 
  InternalServerErrorException,
  ConflictException,
  UnauthorizedException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimStatus, Prisma, Role } from '@prisma/client';
import { CreateClaimDto, UpdateClaimDto } from './dto/claims.dto';
import { bad } from 'src/utils/error.utils'; // Using your typed bad() function
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          bad('Duplicate claim entry detected', 409);
        }
      }
      bad('Failed to create claim', 500);
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
            bank: true,
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
      bad('Claim not found', 404);
    }

    return claim;
  }

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
            bank: true,
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
    console.log({ updateClaimDto });

    const claim = await this.findOne(id);

    if (!claim) {
      bad('Claim not found', 404);
    }

    if (
      (!userRole.includes(Role.DEPT_MANAGER) ||
        !userRole.includes(Role.DEPT_MANAGER)) &&
      updateClaimDto.status
    ) {
      bad('Only managers can update claim status', 403);
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
      bad('You can only delete your own claims', 403);
    }

    await this.prisma.claim.delete({
      where: { id },
    });

    return { message: 'Claim deleted successfully' };
  }

  async updateStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED' | 'PAID',
    approverId: string,
    notes?: string,
    paymentData?: {
      paymentReference?: string;
      paymentMethod?: string;
      paymentVerified?: boolean;
      verifiedAccountName?: string;
      verifiedBankName?: string;
      verifiedAccountNumber?: string;
      paystackReference?: string;
    }
  ) {
    try {
      // 1. Find claim and include user with bank details
      const claim = await this.prisma.claim.findUnique({
        where: { id },
        include: { 
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              bank: true,
            }
          },
          claimPayments: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
      });

      if (!claim) {
        bad('Claim not found', 404);
      }

      if (!claim.user) {
        bad('Claim has no associated user', 400);
      }

      // 2. Validate status transitions
      const validTransitions = {
        [ClaimStatus.PENDING]: ['APPROVED', 'REJECTED'],
        [ClaimStatus.APPROVED]: ['PAID', 'REJECTED'],
        [ClaimStatus.REJECTED]: ['APPROVED'],
        [ClaimStatus.PAID]: []
      };

      const currentStatus = claim.status as ClaimStatus;
      const allowedTransitions = validTransitions[currentStatus] || [];
      
      if (!allowedTransitions.includes(status)) {
        bad(
          `Cannot transition from ${currentStatus} to ${status}. ` +
          `Allowed transitions: ${allowedTransitions.join(', ')}`,
          400
        );
      }

      // 3. Additional validations for PAID status
      if (status === 'PAID') {
        // Check payment reference
        if (!paymentData?.paymentReference && !paymentData?.paystackReference) {
          bad('Payment reference is required for PAID status', 400);
        }

        // Check if account is verified (if paymentVerified is explicitly false)
        if (paymentData?.paymentVerified === false) {
          bad(
            'Account must be verified before marking claim as PAID. Please verify account first.',
            400
          );
        }

        // Check if bank details exist
        if (!claim.user.bank) {
          bad(
            'Employee bank details are missing. Please update employee profile before marking as PAID.',
            400
          );
        }

        // Check if there's already a successful payment
        const hasSuccessfulPayment = claim.claimPayments.some(
          payment => payment.status === 'SUCCESS'
        );
        if (hasSuccessfulPayment) {
          bad('Payment has already been successfully processed for this claim', 409);
        }
      }

      // 4. Prepare update data
      const updateData: any = {
        status: status as ClaimStatus,
        updatedAt: new Date(),
      };

      // Add notes if provided
      if (notes?.trim()) {
        updateData.notes = notes.trim();
      }

      // Add payment-specific data for PAID status
      if (status === 'PAID' && paymentData) {
        // Use paystackReference as paymentReference if provided
        const paymentReference = paymentData.paystackReference || paymentData.paymentReference;
        
        updateData.paymentReference = paymentReference;
        updateData.paymentMethod = paymentData.paymentMethod || 'PAYSTACK';
        updateData.paidAt = new Date();
        
        // Add verification data if provided
        if (paymentData.paymentVerified !== undefined) {
          updateData.paymentVerified = paymentData.paymentVerified;
        }
        if (paymentData.verifiedAccountName) {
          updateData.verifiedAccountName = paymentData.verifiedAccountName;
        }
        if (paymentData.verifiedBankName) {
          updateData.verifiedBankName = paymentData.verifiedBankName;
        }
        if (paymentData.verifiedAccountNumber) {
          updateData.verifiedAccountNumber = paymentData.verifiedAccountNumber;
        }
      } else if (status === 'APPROVED') {
        updateData.approvedAt = new Date();
      } else if (status === 'REJECTED') {
        updateData.rejectedAt = new Date();
      }

      // 5. Update claim
      const updatedClaim = await this.prisma.claim.update({
        where: { id },
        data: updateData,
        include: { 
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              bank: true,
            }
          },
          claimPayments: true
        },
      });

      // 6. Find approver safely
      let approverName = 'Admin';
      try {
        const approver = await this.prisma.user.findUnique({
          where: { id: approverId },
        });
        if (approver) {
          approverName = `${approver.firstName} ${approver.lastName}`;
        }
      } catch (error) {
        console.warn('Failed to find approver:', error);
      }

      // 7. Send notifications
      await this.sendNotifications(updatedClaim, status, approverId, approverName, notes);

      // 8. Return success response
      return {
        success: true,
        data: updatedClaim,
        message: this.getSuccessMessage(status),
        metadata: {
          claimId: updatedClaim.claimId,
          amount: updatedClaim.amount,
          employeeName: `${updatedClaim.user.firstName} ${updatedClaim.user.lastName}`,
          previousStatus: claim.status,
          newStatus: status,
          ...(status === 'PAID' && {
            paymentReference: updatedClaim.paymentReference,
            paidAt: updatedClaim.paidAt,
            paymentVerified: updatedClaim.paymentVerified || false,
          }),
          timestamp: new Date().toISOString(),
        }
      };
      
    } catch (error) {
      console.error('Failed to update claim status:', error);
      
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ForbiddenException ||
          error instanceof ConflictException) {
        throw error;
      }
      
      bad('Unable to update claim status', 500);
    }
  }

  async approveClaim(id: string) {
    const claim = await this.prisma.claim.findUnique({ where: { id } });
    if (!claim) bad('Claim not found', 404);

    return this.prisma.claim.update({
      where: { id },
      data: { status: ClaimStatus.APPROVED },
    });
  }

  async rejectClaim(id: string) {
    const claim = await this.prisma.claim.findUnique({ where: { id } });
    if (!claim) bad('Claim not found', 404);

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

      if (!claim) bad('Claim not found', 404);
      
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) bad('User not found', 404);

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
      bad('Failed to add comment', 500);
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
        claimPayments: true,
      },
    });

    if (!claim) {
      bad('Claim not found', 404);
    }

    if (claim.status !== ClaimStatus.APPROVED) {
      bad('Only approved claims can be paid', 400);
    }

    // Check if there's already a successful payment
    const successfulPayment = claim.claimPayments.find(p => p.status === 'SUCCESS');
    if (successfulPayment) {
      bad('Payment has already been successfully processed for this claim', 409);
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
        bad(`Payment failed: ${paymentResult.message}`, 400);
      }

      // Create ClaimPayment record
      const claimPayment = await this.prisma.claimPayment.create({
        data: {
          claim: { connect: { id } },
          amount: claim.amount,
          recipientName: paystackPaymentDetails.recipientName,
          recipientAccountNumber: paymentDetails.accountNumber,
          recipientBankCode: paymentDetails.bankCode,
          transferReference: paymentResult.transferReference,
          recipientCode: paymentResult.recipientCode,
          status: 'PENDING',
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
          paymentReference: paymentResult.transferReference,
          paymentMethod: 'PAYSTACK',
          paidAt: new Date(),
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
          // error: error.message,
          attemptedAt: new Date(),
        },
      });

      // bad(`Payment processing failed: ${error.message}`, 400);
    }
  }

  async findByTransferReference(transferReference: string) {
    const claim = await this.prisma.claim.findFirst({
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

    if (!claim) {
      bad('Claim with specified transfer reference not found', 404);
    }

    return claim;
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
      bad('Claim or payment not found', 404);
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

  // Helper method to send notifications
  private async sendNotifications(
    claim: any,
    status: 'APPROVED' | 'REJECTED' | 'PAID',
    approverId: string,
    approverName: string,
    notes?: string
  ) {
    const sendMailSafe = async (mailFunc: () => Promise<void>) => {
      try {
        await mailFunc();
      } catch (err: any) {
        console.warn('Failed to send email:', err);
      }
    };

    if (status === 'APPROVED') {
      this.event.emit(
        'claim.approved',
        new ClaimApprovedEvent(
          claim.id,
          claim.userId,
          [claim.userId],
          approverId,
        ),
      );

      await sendMailSafe(() =>
        this.mail.sendClaimApprovalMail({
          email: claim.user.email,
          name: `${claim.user.firstName} ${claim.user.lastName}`,
          claimTitle: claim.title,
          amount: claim.amount.toLocaleString('en-US'),
          date: claim.dateOfExpense,
          approverName,
        })
      );
    } 
    else if (status === 'REJECTED') {
      this.event.emit(
        'claim.rejected',
        new ClaimRejectedEvent(
          claim.id,
          claim.userId,
          [claim.userId],
          approverId,
          notes,
        ),
      );

      await sendMailSafe(() =>
        this.mail.sendClaimRejectionMail({
          email: claim.user.email,
          name: `${claim.user.firstName} ${claim.user.lastName}`,
          claimTitle: claim.title,
          amount: claim.amount.toLocaleString('en-US'),
          date: claim.dateOfExpense,
          approverName,
          reason: notes,
        })
      );
    } 
    else if (status === 'PAID') {
      this.event.emit(
        'claim.paid',
        new ClaimPaidEvent(
          claim.id,
          claim.userId,
          [claim.userId],
          approverId,
          claim.paymentReference,
          // claim.amount,
        ),
      );

      // Send payment confirmation email
      await sendMailSafe(() =>
        this.mail.sendPaymentConfirmationMail({
          email: claim.user.email,
          name: `${claim.user.firstName} ${claim.user.lastName}`,
          claimTitle: claim.title,
          amount: claim.amount.toLocaleString('en-US'),
          paymentReference: claim.paymentReference,
          paymentMethod: claim.paymentMethod,
          accountName: claim.verifiedAccountName || `${claim.user.firstName} ${claim.user.lastName}`,
          bankName: claim.verifiedBankName || claim.user.bank?.bankName,
          accountNumber: claim.verifiedAccountNumber || claim.user.bank?.accountNumber?.slice(-4),
          date: new Date().toLocaleDateString(),
        })
      );
    }
  }

  // Helper method to get success messages
  private getSuccessMessage(status: string): string {
    const messages = {
      APPROVED: 'Claim approved successfully',
      REJECTED: 'Claim rejected successfully',
      PAID: 'Claim marked as paid successfully'
    };
    return messages[status] || 'Claim status updated successfully';
  }

  // Add method to update claim verification status separately
  async updateClaimVerification(
    claimId: string,
    verificationData: {
      paymentVerified: boolean;
      verifiedAccountName?: string;
      verifiedBankName?: string;
      verifiedAccountNumber?: string;
    }
  ) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId }
    });

    if (!claim) {
      bad('Claim not found', 404);
    }

    // Can only verify approved claims
    if (claim.status !== ClaimStatus.APPROVED) {
      bad('Only approved claims can be verified', 400);
    }

    const updatedClaim = await this.prisma.claim.update({
      where: { id: claimId },
      data: {
        ...verificationData,
        verifiedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            bank: true,
          }
        }
      },
    });

    return {
      success: true,
      data: updatedClaim,
      message: verificationData.paymentVerified 
        ? 'Account verified successfully'
        : 'Account verification status updated'
    };
  }
}