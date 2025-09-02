import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLeaveRequestDto } from './dto/leave.dto';
import { bad } from 'src/utils/error.utils';
import { Role, User } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LeaveApprovedEvent, LeaveRequestedEvent } from 'src/events/leave.event';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class LeaveService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly event: EventEmitter2,
        private readonly mail: MailService,
    ) {}

    async createLeaveRequest(userId: string, data: CreateLeaveRequestDto) {
        const { typeId, doaId, reason, startDate, endDate } = data;
        // const userId = user.sub
        try {
            //Find employee
            const employee = await this.findEmployee(userId);

            //Check if requested leave type is available for employee's level
            const availableEntitlement = employee.level.entitlements.find(
                ent => ent.entitlement.id === typeId
            );

            if(!availableEntitlement) {
                throw bad("Leave type is not available for your level");
            }

            //Calculate leave duration against entitlement balance
            const duration = this.calculateLeaveDuration(startDate, endDate);
            if(duration > availableEntitlement.value) {
                throw bad(`Insufficient leave balance. You have ${availableEntitlement.value} days remaining.`);
            }

            //Create Leave Request
            const request = await this.prisma.leaveRequest.create({
                data: {
                    doaId,
                    // reason,
                    startDate,
                    endDate,
                    typeId,
                    userId: userId,
                    reason: {
                        create: {
                            comment: reason,
                            createdAt: new Date()
                         },
                     },
                    // uploads: {
                    //     connect: data.uploads.map((uploadId: string) => ({ id: uploadId})),
                    // }, 
                },
                include: { uploads: true, approvals: true },
                
            });
              // Initialize approval process
            const firstApproval = await this.initializeApprovalFlow(request.id, userId)
            //Notify the first approver
            await this.sendLeaveRequestMail(request.id);
            return {
                ...request,
                currentApproval: firstApproval,
            };
        } catch (error) {
                  if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                   
                  }
                   console.log(error);
                  throw new BadRequestException('Failed to create leave request');
                  
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
                  throw new BadRequestException('Failed to fetch leave requests');
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
        throw new BadRequestException('Failed to check leave balance');
    }
}

    async initializeApprovalFlow(leaveRequestId: string, userId: string) {
        try {
             const employee = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                department: true,
                level: true
            },
        });
        if(!employee) {
            throw bad("Employee Not Found");
        }

        //Check if employee is a department head
        const isDepartmentHead = employee.department?.departmentHeadId === userId;

        //Create approval flow based on employee role
        if(isDepartmentHead) {
            //Department head only needs HR approval
            const hrApprover = await this.getHrApprover();
            await this.createApprovalStep(leaveRequestId, 2, hrApprover.id);
        } else {
            //Regular staff needs both Department head and HR
            const departmentHeadId = employee.department?.departmentHeadId;
            if(!departmentHeadId) {
                throw bad("Department Head Not Found");
            }
            await this.createApprovalStep(leaveRequestId, 1, departmentHeadId);

            const hrApprover = await this.getHrApprover();
            await this.createApprovalStep(leaveRequestId, 2, hrApprover.id);
        }

        const firstApproval = await this.prisma.approval.findFirst({
            where: { leaveRequestId, phase: 1 },
            orderBy: { phase: 'asc' },
        });
        if(firstApproval) {
            
            // this.event.emit(
            //     'leave.requested',
            //     new LeaveRequestedEvent(leaveRequestId, [employee.id], firstApproval.id )
            // )
            await this.prisma.leaveRequest.update({
                where: { id: leaveRequestId },
                data: { currentApprovalId: firstApproval.id },
            });
        }
        //Notify first approver
            // await this.mail.sendLeaveRequestMail({
            //     email: le,
            // })
        return firstApproval;

        } catch (error) {
                  if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                  }
                  console.log(error)
                  throw new BadRequestException('Failed to initialize approval flow');
          }
       
    }

    async approveLeaveRequest(approvalId: string, approverId: string, comment?: string) {
        try {
            // const approverId = approver.sub;
            const request =  this.prisma.$transaction(async (tx) => {
                const approval = await tx.approval.findUnique({
                    where: { id: approvalId },
            });
            if (!approval) {
                throw bad('Approval step not found');
            }

            if (approval.approverId !== approverId) {
                throw bad('You are not authorized to approve this request');
            }

            if (approval.status !== 'PENDING') {
                throw bad('This request has already been processed');
            }

            //Approve current step
            await tx.approval.update({
                where: { id: approvalId },
                data: {
                    status: 'APPROVED',
                    reason: comment,
                    actionDate: new Date(),
                },
            });

            //Check if there are other approval steps
            const nextApproval = await tx.approval.findFirst({
                where: {
                    leaveRequestId: approval.leaveRequestId,
                    phase: approval.phase + 1,
                    status: 'PENDING',
                },
                orderBy: { phase: 'asc' },
            });
            if (nextApproval) {
                //Update leave request with next approval step
                await tx.leaveRequest.update({
                    where: { id: approval.leaveRequestId },
                    data: { currentApprovalId: nextApproval.id },
                });

                //Notify next approver
                const leaveRequest = await tx.leaveRequest.findUnique({
                    where: { id: approval.leaveRequestId },
                });
                if(leaveRequest) {
                    this.event.emit(
                        'leave.requested',
                        new LeaveRequestedEvent(leaveRequest.userId, [nextApproval.approverId], leaveRequest.id )
                    )
                }
                return nextApproval;
            } else {
                //No more approval steps, mark leave request as approved
                await tx.leaveRequest.update({
                    where: { id: approval.leaveRequestId },
                    data: { 
                        status: 'APPROVED',
                        currentApprovalId: null,
                     },
                });

                const leaveRequest = await tx.leaveRequest.findUnique({
                    where: { id: approval.leaveRequestId },
                });
                if(leaveRequest) {
                    this.event.emit(
                        'leave_approved',
                        new LeaveApprovedEvent(leaveRequest.userId, leaveRequest.id, approverId )
                    )
                }
                //Notify employee of the current approval
                await this.sendApprovalMail(approval.leaveRequestId);
            }
            

        });
        return request;
        } catch (error) {
                  if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                  }
                  throw new BadRequestException('Failed to approve leave request');
          }
    }

//     async approveLeaveRequest(approvalId: string, approverId: string, comment?: string) {
//     try {
//         return await this.prisma.$transaction(async (tx) => {
//             const approval = await tx.approval.findUnique({
//                 where: { id: approvalId },
//             });
            
//             if (!approval) {
//                 throw bad('Approval step not found');
//             }

//             if (approval.approverId !== approverId) {
//                 throw bad('You are not authorized to approve this request');
//             }

//             if (approval.status !== 'PENDING') {
//                 throw bad('This request has already been processed');
//             }

//             // Approve current step
//             await tx.approval.update({
//                 where: { id: approvalId },
//                 data: {
//                     status: 'APPROVED',
//                     reason: comment,
//                     actionDate: new Date(),
//                 },
//             });

//             // Check if there are other approval steps
//             const nextApproval = await tx.approval.findFirst({
//                 where: {
//                     leaveRequestId: approval.leaveRequestId,
//                     phase: approval.phase + 1,
//                     status: 'PENDING',
//                 },
//                 orderBy: { phase: 'asc' },
//             });
            
//             if (nextApproval) {
//                 // Update leave request with next approval step
//                 await tx.leaveRequest.update({
//                     where: { id: approval.leaveRequestId },
//                     data: { currentApprovalId: nextApproval.id },
//                 });

//                 // Return the next approval - email will be sent outside transaction
//                 return { nextApproval, shouldSendEmail: false };
//             } else {
//                 // No more approval steps, mark leave request as approved
//                 await tx.leaveRequest.update({
//                     where: { id: approval.leaveRequestId },
//                     data: { 
//                         status: 'APPROVED',
//                         currentApprovalId: null,
//                     },
//                 });

//                 // Return success - email will be sent outside transaction
//                 return { nextApproval: null, shouldSendEmail: true, leaveRequestId: approval.leaveRequestId };
//             }
//         }, 
//         {
//             maxWait: 10000, // Increase transaction timeout
//             timeout: 10000,
//         });

        
//     } catch (error) {
//         if (error instanceof BadRequestException || 
//             error instanceof NotFoundException || 
//             error instanceof ConflictException) {
//             throw error;
//         }
//         throw new BadRequestException('Failed to approve leave request');
//     }
// }

    async rejectLeaveRequest(approvalId: string, approverId: string, comment: string) { 
        try {
            // const approverId = approver.sub;
            return this.prisma.$transaction(async(tx) =>{
            const approval = await tx.approval.findUnique({
                 where: { id: approvalId },
                 include: { leaveRequest: true },
            });
            if (!approval) {
                throw bad('Approval step not found');
            }

            if (approval.approverId !== approverId) {
                throw bad('You are not authorized to approve this request');
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

            //Notify employee of rejection
            await this.sendRejectionMail(approval.leaveRequestId, comment);
            
            return approval;
            });
        } catch (error) {
                  if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                  }
                  throw new BadRequestException('Failed to reject leave request');
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
                  throw new BadRequestException('Failed to get approval history');
          }
    
}



    /////////////////////////////////////// HELPERS ///////////////////////////////
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
                  throw new BadRequestException('Failed to find employee');
             }
        
    }

    private async findEmployee(userId: string) {
        try {
            const employee = await this.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    requests: true,
                    level: {
                        include: {
                            entitlements: {
                                include: {
                                    entitlement: true
                                }
                            }
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
                  throw new BadRequestException('Failed to find employee');
             }
    }

    private async getHrApprover(): Promise<User> {
        try {
            const hr = await this.prisma.user.findFirst({
                where: { userRole: Role.HR, },
            });
            if(!hr) {
                throw bad("HR Not Found");
            }
            return hr;
        } catch (error) {
                  if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                  }
                  throw new BadRequestException('Failed to get HR');
             }
    }

    private async createApprovalStep(leaveRequestId: string, phase: number, approverId: string) {
        try {
            return this.prisma.approval.create({
                data: {
                    leaveRequestId,
                    phase,
                    approverId,
                    status: 'PENDING',
                },
            });
        } catch (error) {
                  if (error instanceof BadRequestException || 
                      error instanceof NotFoundException || 
                      error instanceof ConflictException) {
                    throw error;
                  }
                  throw new BadRequestException('Failed to create approval step');
             }
    }

private async sendLeaveRequestMail(leaveRequestId: string) {
    try {
        const leaveRequest = await this.prisma.leaveRequest.findUnique({
            where: { id: leaveRequestId },
            include: { 
                user: true,
                type: true,
                reason: true,
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

        if (!leaveRequest) {
            console.error('Leave request not found');
            return false;
        }

        if (!leaveRequest.user) {
            console.error('User not found for leave request');
            return false;
        }

        // Find the first approver (the one who needs to approve first)
        const firstApproval = leaveRequest.approvals.find(approval => approval.phase === 1);
        
        if (!firstApproval || !firstApproval.approver) {
            console.error('First approver not found for leave request');
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
            email: firstApproval.approver.workEmail,
            name: `${firstApproval.approver.firstName} ${firstApproval.approver.lastName}`,
            leaveType: leaveRequest.type.name,
            startDate: leaveRequest.startDate,
            endDate: leaveRequest.endDate,
            leaveValue: levelEntitlement?.value,
            reason: Array.isArray(leaveRequest.reason) && leaveRequest.reason.length > 0 ? leaveRequest.reason[0].comment : 'No reason provided',
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
        await this.mail.sendLeaveApprovalMail({
            email: approval.user.workEmail,
            name: `${approval.user.firstName} ${approval.user.lastName}`,
            leaveType: approval.type.name,
            startDate: approval.startDate,
            endDate: approval.endDate,
            leaveValue: approval.type.levels.find(ty => ty.value)?.value,
            approver: approval.approvals.find(app => app.status === 'APPROVED')?.approver.userRole,
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

    const lastApproval = leaveRequest.approvals[0];

    await this.mail.sendLeaveRejectMail({
        email: leaveRequest.user.workEmail,
        name: `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`,
        leaveType: leaveRequest.type.name,
        leaveValue: leaveRequest.type.levels.find(ty => ty.value)?.value,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        reason: comment,
        approver: lastApproval?.approver.userRole,
    });

    return true;
    }

}
