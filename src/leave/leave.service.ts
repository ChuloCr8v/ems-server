import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLeaveRequestDto } from './dto/leave.dto';
import { bad } from 'src/utils/error.utils';
import { Approver, Role, User } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LeaveApprovedEvent, LeaveRequestedEvent } from 'src/events/leave.event';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { MailService } from 'src/mail/mail.service';
import { ApproverService } from 'src/approver/approver.service';

@Injectable()
export class LeaveService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly event: EventEmitter2,
        private readonly mail: MailService,
        private readonly approver: ApproverService,
    ) {}

        async createLeaveRequest(userId: string, data: CreateLeaveRequestDto) {
        const { typeId, doaId, reason, startDate, endDate } = data;
        
        try {
            // Find employee with level and entitlements
            const employee = await this.findEmployee(userId);

            // Check if requested leave type is available for employee's level
            const availableEntitlement = employee.level.entitlements.find(
                ent => ent.entitlement.id === typeId
            );

            if (!availableEntitlement) {
                throw bad("Leave type is not available for your level");
            }

            // Calculate leave duration against entitlement balance
            const duration = this.calculateLeaveDuration(startDate, endDate);
            if (duration > availableEntitlement.value) {
                throw bad(`Insufficient leave balance. You have ${availableEntitlement.value} days remaining.`);
            }

            // Create Leave Request
            const request = await this.prisma.leaveRequest.create({
                data: {
                    doaId,
                    startDate,
                    endDate,
                    typeId,
                    userId: userId,
                    reason,
                    // uploads: {
                    //     connect: data.uploads.map((uploadId: string) => ({ id: uploadId})),
                    // }, 
                },
                include: { 
                    uploads: true, 
                    approvals: true,
                    type: true,
                },
            });

            // Initialize approval process
            const firstApproval = await this.initializeApprovalFlow(request.id, userId);
            
            return {
                ...request,
                currentApproval: firstApproval,
            };
        } catch (error) {
            if (error instanceof BadRequestException || 
                error instanceof NotFoundException || 
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to create leave request: ' + error.message);
        }
    }

    async getAvailableLeaveTypes(userId: string) {
        try {
            // const userId = user.sub
            //Find employee
            const employee = await this.findEmployee(userId);
            const leave =  employee.level.entitlements
                .filter(ent => ent.entitlement.unit.includes('days'))
                .map(ent => ({
                    id: ent.entitlement.id,
                    name: ent.entitlement.name,
                    value: ent.value,
                    unit: ent.entitlement.unit
                }));
                return leave;
        } catch (error) {
                  if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                  }
                  throw new BadRequestException('Failed to fetch leave requests:' + error.message);
          }
    }

    async checkLeaveBalance(userId: string, typeId: string) {
        try {
            // const userId = user.sub
            // Get the entitlement value for this user's level
            const levelEntitlement = await this.prisma.levelEntitlement.findFirst({
                where: {
                    entitlementId: typeId,
                    level: {
                        users: {
                            some: { id: userId }
                        }
                    }
                },
                include: {
                    entitlement: true
                }
            });

            if (!levelEntitlement) {
                throw bad("Leave type not available for your level");
            }

            // Get approved leave requests for current year
            const leaveRequests = await this.prisma.leaveRequest.findMany({
                where: {
                    userId,
                    typeId,
                    status: 'APPROVED',
                    startDate: { 
                        gte: new Date(new Date().getFullYear(), 0, 1) 
                    },
                },
                select: { startDate: true, endDate: true },
            });

            // Calculate total used leave days
            const usedDays = leaveRequests.reduce((total, leave) => {
                const start = new Date(leave.startDate);
                const end = new Date(leave.endDate);
                const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
                return total + days;
            }, 0);

            return {
                entitlement: levelEntitlement.value,
                usedLeaveDays: usedDays,
                balance: levelEntitlement.value - usedDays,
                unit: levelEntitlement.entitlement.unit
            };
        } catch (error) {
            if (error instanceof BadRequestException || 
                error instanceof NotFoundException || 
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to check leave balance:' + error.message);
        }
    }

      async initializeApprovalFlow(leaveRequestId: string, userId: string) {
            try {
                const employee = await this.prisma.user.findUnique({
                    where: { id: userId },
                    include: { department: true },
                });
                
                if (!employee) {
                    throw new NotFoundException("Employee Not Found");
                }

                // Get all potential approvers for this user
                const approvers = await this.approver.getApproversForUser(userId);
                
                if (approvers.length === 0) {
                    throw new NotFoundException("No approvers found for this employee");
                }

                // Filter out the department head themselves if they're applying
                const filteredApprovers = approvers.filter(approver => 
                    approver.userId !== userId // Don't allow self-approval
                );

                if (filteredApprovers.length === 0) {
                    throw new NotFoundException("No valid approvers found (cannot self-approve)");
                }

                // Create approval steps for each approver
                const approvalSteps = [];
                let phase = 1;
                
                for (const approver of approvers) {
                    // Check if this approver can approve for this employee
                    const canApprove = await this.approver.canUserApprove(approver.userId, userId);
                    
                    if (canApprove) {
                        // THIS IS WHERE createApprovalStep IS CALLED
                        const approval = await this.createApprovalStep(leaveRequestId, phase, approver.userId);
                        approvalSteps.push(approval);
                        phase++;
                    }
                }

                if (approvalSteps.length === 0) {
                    throw new NotFoundException("No valid approvers found for this employee");
                }

                const firstApproval = approvalSteps[0];
                
                if (firstApproval) {
                    // Notify first approver
                     setTimeout(() => {
                        this.sendLeaveRequestMail(leaveRequestId).catch(console.error);
                        // this.event.emit(
                        //     'leave_approved',
                        //     new LeaveApprovedEvent(approval.leaveRequestId, approverId)
                        // );
                    }, 0)
                    // this.event.emit(
                    //     'leave.requested',
                    //     new LeaveRequestedEvent(leaveRequestId, [userId], firstApproval.id)
                    // );
                    
                    await this.prisma.leaveRequest.update({
                        where: { id: leaveRequestId },
                        data: { currentApprovalId: firstApproval.id },
                    });
                }
                
                return firstApproval;
            } catch (error) {
                console.error('Error in initializeApprovalFlow:', error);
                throw new BadRequestException('Failed to initialize approval flow: ' + error.message);
            }
        }

       async approveLeaveRequest(approvalId: string, approverId: string, comment?: string) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const approval = await tx.approval.findUnique({
                    where: { id: approvalId },
                    include: {
                        leaveRequest: {
                            include: {
                                user: true
                            }
                        }
                    }
                });
                
                if (!approval) {
                    throw bad('Approval not found');
                }

                // Check if the user can approve this request
                const canApprove = await this.approver.canUserApprove(approverId, approval.leaveRequest.userId);
                
                if (!canApprove) {
                    throw bad('You are not authorized to approve this request');
                }

                if (approval.status !== 'PENDING') {
                    throw bad('This request has already been processed');
                }

                // Approve current phase
                await tx.approval.update({
                    where: { id: approvalId },
                    data: {
                        status: 'APPROVED',
                        reason: comment,
                        actionDate: new Date(),
                    },
                });

                // Check if there's a next approval
                const nextApproval = await tx.approval.findFirst({
                    where: {
                        leaveRequestId: approval.leaveRequestId,
                        phase: approval.phase + 1,
                        status: 'PENDING',
                    },
                });
                
                if (nextApproval) {
                    // Update to next approval phase
                    await tx.leaveRequest.update({
                        where: { id: approval.leaveRequestId },
                        data: { currentApprovalId: nextApproval.id },
                    });

                    // Notify next approver
                    setTimeout(() => {
                        // this.event.emit(
                        //     'leave.requested',
                        //     new LeaveRequestedEvent(approval.leaveRequestId, [approval.leaveRequest.userId], nextApproval.id)
                        // );
                    }, 0);

                    return { 
                        approval: nextApproval, 
                        isFinal: false,
                        message: 'Approval moved to next phase' 
                    };
                } else {
                    // No more phases, approve the entire leave request
                    await tx.leaveRequest.update({
                        where: { id: approval.leaveRequestId },
                        data: { 
                            status: 'APPROVED',
                            currentApprovalId: null,
                        },
                    });

                    // Notify employee of approval
                    setTimeout(() => {
                        this.sendApprovalMail(approval.leaveRequestId).catch(console.error);
                        // this.event.emit(
                        //     'leave_approved',
                        //     new LeaveApprovedEvent(approval.leaveRequestId, approverId)
                        // );
                    }, 0);

                    return { 
                        approval: null, 
                        isFinal: true,
                        message: 'Leave request fully approved' 
                    };
                }
            }, {
                maxWait: 10000,
                timeout: 10000,
            });
        } catch (error) {
            if (error instanceof BadRequestException || 
                error instanceof NotFoundException || 
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to approve leave request: ' + error.message);
        }
    }

    async rejectLeaveRequest(approvalId: string, approverId: string, comment: string) { 
        try {
            // const approverId = approver.sub;
            return this.prisma.$transaction(async(tx) =>{
            const approval = await tx.approval.findUnique({
                 where: { id: approvalId },
                 include: { leaveRequest: true },
            });
            if (!approval) {
                throw bad('Approval not found');
            }

            if (approval.approverId !== approverId) {
                throw bad('You are not authorized to reject this request');
            }

            if (approval.status !== 'PENDING') {
                throw bad('This request has already been processed');
            }
            // Reject the current approval step
            await tx.approval.update({
                where: {id: approvalId },
                data: {
                    status: 'REJECTED',
                    actionDate: new Date(),
                    reason: comment,
                }
            });
            //Reject the entire leave request
            await tx.leaveRequest.update({
                where: { id: approval.leaveRequestId },
                data: {
                    status: 'REJECTED',
                    currentApprovalId: null,
                }
            });

            // Notify employee of rejection
            setTimeout(() => {
                this.sendRejectionMail(approval.leaveRequestId, comment).catch(console.error);
            }, 0);
            
            return approval;
            });
        } catch (error) {
                  if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                  }
                  throw new BadRequestException('Failed to reject leave request:' + error.message);
          }
    }

    async getApprovalHistory(leaveRequestId: string) {
        try {
            return this.prisma.approval.findMany({
               where: { leaveRequestId },
                include: {
                    approver: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        role: true,
                    },
                    },
                },
                orderBy: { phase: 'asc' },  
            });
        } catch (error) {
                  if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                  }
                  throw new BadRequestException('Failed to get approval history:' + error.message);
          }
    
}



//     /////////////////////////////////////// HELPERS ////////////////////////////////////////
    private calculateLeaveDuration(startDate: Date, endDate: Date): number {
        try {
            if(!startDate || !endDate) {
            throw bad("Start date and end date are required");
            }
            if(startDate > endDate) {
                throw bad("Start date cannot be after end date");
            }

            //Bussiness days
            let currentDate = new Date(startDate);
            let businessDays = 0;
            while(currentDate <= endDate) {
                const weekDay = currentDate.getDay();
                //Exclude Weekends 
                if(weekDay !== 0 && weekDay !== 6) {
                    businessDays++;
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            return businessDays;
        } catch (error) {
                  if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                  }
                  throw new BadRequestException('Failed to find employee:' + error.message);
             }
        
    }

        private async createApprovalStep(leaveRequestId: string, phase: number, approverId: string) {
        try {
            // Verify the approver exists and is active
            const approver = await this.prisma.approver.findFirst({
                where: {
                    userId: approverId,
                    isActive: true
                }
            });

            if (!approver) {
                throw new NotFoundException(`Approver with user ID ${approverId} not found or inactive`);
            }

            return await this.prisma.approval.create({
                data: {
                    leaveRequestId,
                    phase,
                    approverId,
                    status: 'PENDING',
                },
                include: {
                    approver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating approval step:', error);
            
            if (error.code === 'P2002') {
                throw new ConflictException(`Approval phase ${phase} already exists for this leave request`);
            }
            
            if (error.code === 'P2003') {
                throw new NotFoundException(`Approver with ID ${approverId} not found`);
            }
            
            throw new BadRequestException('Failed to create approval step: ' + error.message);
        }
    }


    private async findEmployee(userId: string) {
        try {
            const employee = await this.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    requests: true,
                    department: true,
                    level: {
                        include: {
                            entitlements: {
                                include: {
                                    entitlement: true
                                }
                            },
                        }
                    },
                },
            });
            if(!employee) {
                throw bad("Employee Not Found");
            }
            return employee;
        } catch (error) {
                  if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                  }
                  throw new BadRequestException('Failed to find employee:' + error.message);
             }
    }

//     private async getHrApprover(): Promise<User> {
//         try {
//             const hr = await this.prisma.user.findFirst({
//                 where: { userRole: Role.HR, },
//             });
//             if(!hr) {
//                 throw bad("HR Approver Not Found");
//             }
//             return hr;
//         } catch (error) {
//                   if (error instanceof BadRequestException || 
//                       error instanceof NotFoundException || 
//                       error instanceof ConflictException) {
//                     throw error;
//                   }
//                   throw new BadRequestException('Failed to get HR:' + error.message);
//              }
//     }



    private async sendLeaveRequestMail(leaveRequestId: string) {
        try {
            const leaveRequest = await this.prisma.leaveRequest.findUnique({
                where: { id: leaveRequestId },
                include: { 
                    user: true,
                    type: true,
                    approvals: { 
                        include: { 
                            approver: true 
                        },
                        orderBy: {
                            phase: 'asc'
                        }
                    }
                },
            });

            if (!leaveRequest || !leaveRequest.user) {
                console.error('Leave request or user not found');
                return false;
            }

            // Get the current approval (first pending approval)
            const currentApproval = leaveRequest.approvals.find(a => a.status === 'PENDING');
            
            if (!currentApproval || !currentApproval.approver) {
                console.error('Current approver not found for leave request');
                return false;
            }

            // Get the entitlement value for this user's level and leave type
            const levelEntitlement = await this.prisma.levelEntitlement.findFirst({
                where: {
                    entitlementId: leaveRequest.typeId,
                    level: {
                        users: {
                            some: { id: leaveRequest.userId }
                        }
                    }
                },
                select: {
                    value: true
                }
            });

            await this.mail.sendLeaveRequestMail({
                email: currentApproval.approver.workEmail,
                name: `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`,
                leaveType: leaveRequest.type.name,
                startDate: leaveRequest.startDate,
                endDate: leaveRequest.endDate,
                leaveValue: levelEntitlement?.value,
                reason: leaveRequest.reason || 'No reason provided',
            });
            
            return true;
        } catch (error) {
            console.error('Failed to send leave request email:', error);
            return false;
        }
    }

    private async sendApprovalMail(leaveRequestId: string) {
        const approval = await this.prisma.leaveRequest.findUnique({
            where: { id: leaveRequestId },
            include: { 
                approvals: {
                    include: {
                        approver: true,
                    }
                },
                user: true,
                type: { include: { levels: true, } },
            }
        });

        const duration = this.calculateLeaveDuration(approval.startDate, approval.endDate);
        await this.mail.sendLeaveApprovalMail({
            email: approval.user.workEmail,
            name: `${approval.user.firstName} ${approval.user.lastName}`,
            leaveType: approval.type.name,
            startDate: approval.startDate,
            endDate: approval.endDate,
            leaveValue: duration,
        });
        return true;
      }

    private async sendRejectionMail(leaveRequestId: string, comment: string) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
            where: { id: leaveRequestId },
            include: {
                user: true,
                type: { include: { levels: true } },
                approvals: {
                include: { approver: true },
                orderBy: { actionDate: 'desc' },
                take: 1,
                },
            },
       });

     if (!leaveRequest?.user) return false;

    // const lastApproval = leaveRequest.approvals[0];
    const duration = this.calculateLeaveDuration(leaveRequest.startDate, leaveRequest.endDate);

    await this.mail.sendLeaveRejectMail({
        email: leaveRequest.user.workEmail,
        name: `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`,
        leaveType: leaveRequest.type.name,
        leaveValue: duration,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        reason: comment,
    });

    return true;
    }


}
