import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLeaveRequestDto } from './dto/leave.dto';
import { bad, mustHave } from 'src/utils/error.utils';
import { Approver, Prisma, PrismaClient, Role, User } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
    ) { }

    async createLeaveRequest(userId: string, data: CreateLeaveRequestDto) {
        const { typeId, doaId, reason, startDate, endDate, uploads } = data;

        return this.prisma.$transaction(async (tx) => {
            // 1. Find employee with entitlements
            const employee = await this.findEmployee(userId);
            if (!employee) {
                throw new NotFoundException("Employee not found");
            }

            // // 2. Check pending requests
            // const pending = await tx.leaveRequest.findFirst({
            //     where: { userId, status: "PENDING" },
            // });
            // if (pending) {
            //     throw new ConflictException("You already have a pending leave request");
            // }

            // // 3. Check active approved leave overlap
            // const activeLeave = await tx.leaveRequest.findFirst({
            //     where: {
            //         userId,
            //         status: "APPROVED",
            //         startDate: { lte: endDate },
            //         endDate: { gte: startDate },
            //     },
            // });
            // if (activeLeave) {
            //     throw new ConflictException(
            //         "You already have an active approved leave in this period"
            //     );
            // }

            // 4. Validate entitlement
            const availableEntitlement = employee.level.entitlements.find(
                (ent) => ent.entitlement.id === typeId
            );
            if (!availableEntitlement) {
                throw new BadRequestException(
                    "Leave type not available for your level"
                );
            }

            // 5. Calculate duration 
            const duration = this.calculateLeaveDuration(startDate, endDate);

            if (duration > availableEntitlement.value) {
                throw new BadRequestException(
                    `Insufficient leave balance. You have ${availableEntitlement.value} days remaining.`
                );
            }

            const request = await tx.leaveRequest.create({
                data: {
                    doaId,
                    startDate,
                    endDate,
                    typeId,
                    userId,
                    reason,
                    duration,
                    ...(uploads?.length
                        ? { uploads: { connect: uploads.map((id: string) => ({ id })) } }
                        : {}),
                },
                include: {
                    uploads: true,
                    approvals: true,
                    type: true,
                },
            });

            // 7. Initialize approval flow 
            const firstApproval = await this.initializeApprovalFlow(
                request.id,
                userId,
                tx
            );

            return {
                ...request,
                currentApproval: firstApproval,
            };
        });
    }

    async getAvailableLeaveTypes(userId: string) {
        try {
            const employee = await this.findEmployee(userId);

            const leave = employee.level.entitlements
                .filter(ent => ent.entitlement.unit.includes('DAYS'))
                .map(ent => ({
                    id: ent.entitlement.id,
                    name: ent.entitlement.name,
                    value: ent.value,
                    unit: ent.entitlement.unit
                }));

            const leaveWithBalance = await Promise.all(
                leave.map(async l => {
                    const balance = await this.checkLeaveBalance(userId, l.id);

                    return {
                        ...l,
                        balance
                    };
                })
            );

            return leaveWithBalance;

        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException
            ) {
                throw error;
            }
            throw new BadRequestException('Failed to fetch leave requests: ' + error.message);
        }
    }

    async listLeaveRequests(userId: string) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                include: { approver: true },
            });

            if (!user) mustHave(user, "User not found", 404);

            const leaveRequests = await this.prisma.leaveRequest.findMany({
                include: {
                    user: {
                        include: { approver: true }
                    },
                    type: true,
                    uploads: true,
                    approvals: {
                        include: {
                            approver: true
                        }
                    },
                },
                orderBy: { createdAt: "desc" },
            });

            if (user.userRole.includes(Role.ADMIN) || user.userRole.includes(Role.LEAVE_MANAGER)) {
                return leaveRequests;
            }
            if (user.approver.length) {
                return leaveRequests.filter(l =>
                    l.approvals.filter(a => a.approverId === userId)
                );
            }

            return leaveRequests.filter(l => l.userId === userId);

        } catch (error: any) {
            bad("Failed to fetch leave requests: " + error.message);
        }
    }

    async listUserLeaveRequests(userId: string) {
        try {

            const user = await this.prisma.user.findUnique({
                where: { id: userId }
            })

            if (!user) mustHave(user, "User not found!", 404)

            const leave = this.prisma.leaveRequest.findMany({
                where: {
                    userId
                },
                include: {
                    user: true,
                    type: true,
                    uploads: true,
                    approvals: {
                        include: {
                            approver: true
                        },
                        orderBy: {
                            phase: "asc"
                        }
                    },
                }
                ,
                orderBy: { createdAt: 'desc' }
            })
            return leave ?? [];
        } catch (error) {
            bad('Failed to fetch leave requests:' + error.message);
        }
    }

    async listUserLeave(userId: string) {
        try {
            // const userId = user.sub
            //Find employee
            const employee = await this.findEmployee(userId);

            !employee && mustHave(employee, "Employee not found", 404)
            const leave = this.prisma.leaveRequest.findMany({
                where: {
                    userId
                }
            })
            return leave ?? [];
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
            const levelEntitlement = await this.prisma.levelEntitlement.findFirst({
                where: {
                    entitlementId: typeId,
                    level: {
                        users: { some: { id: userId } }
                    }
                },
                include: { entitlement: true }
            });

            if (!levelEntitlement) {
                throw new BadRequestException("Leave type not available for your level");
            }

            const countBusinessDays = (start: Date, end: Date) => {
                let days = 0;
                let current = new Date(start);
                while (current <= end) {
                    const day = current.getDay();
                    if (day !== 0 && day !== 6) days++;
                    current.setDate(current.getDate() + 1);
                }
                return days;
            };

            const startOfYear = new Date(new Date().getFullYear(), 0, 1);

            // Fetch leave requests for current year
            const leaveRequests = await this.prisma.leaveRequest.findMany({
                where: {
                    userId,
                    typeId,
                    startDate: { gte: startOfYear },
                },
                select: { startDate: true, endDate: true, status: true },
            });

            // Separate approved and rejected leaves
            const usedDays = leaveRequests
                .filter(l => l.status === 'APPROVED')
                .reduce((total, leave) => total + countBusinessDays(new Date(leave.startDate), new Date(leave.endDate)), 0);

            const rejectedLeaveDays = leaveRequests
                .filter(l => l.status === 'REJECTED')
                .reduce((total, leave) => total + countBusinessDays(new Date(leave.startDate), new Date(leave.endDate)), 0);

            const pendingLeaveDays = leaveRequests
                .filter(l => l.status === 'PENDING')
                .reduce((total, leave) => total + countBusinessDays(new Date(leave.startDate), new Date(leave.endDate)), 0);

            return {
                entitlement: levelEntitlement.value,
                usedLeaveDays: usedDays,
                pendingLeaveDays,
                rejectedLeaveDays,
                balance: levelEntitlement.value - usedDays,
                unit: levelEntitlement.entitlement.unit
            };

        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Failed to check leave balance: ' + error.message);
        }
    }


    async initializeApprovalFlow(
        leaveRequestId: string,
        userId: string,
        prisma: PrismaClient | Prisma.TransactionClient = this.prisma
    ) {
        const employee = await prisma.user.findUnique({
            where: { id: userId },
            include: { departments: true },
        });

        if (!employee) throw new NotFoundException("Employee Not Found");

        const approvers = await this.approver.getApproversForUser(userId);

        if (approvers.length === 0) {
            throw new NotFoundException("No approvers found for this employee");
        }

        // Filter out self
        const filteredApprovers = approvers.filter((a) => a.id !== userId);
        if (filteredApprovers.length === 0) {
            throw new NotFoundException("No valid approvers found (cannot self-approve)");
        }

        // Create approval steps
        const approvalSteps = [];
        let phase = 1;

        for (const approver of filteredApprovers) {

            const canApprove = await this.approver.canUserApprove(approver.id, userId);

            if (canApprove) {
                const approval = await this.createApprovalStep(
                    leaveRequestId,
                    phase,
                    approver.id,
                    prisma
                );
                approvalSteps.push(approval);
                phase++;
            }
        }

        if (approvalSteps.length === 0) {
            throw new NotFoundException("No valid approvers found for this employee");
        }

        const firstApproval = approvalSteps[0];

        if (firstApproval) {
            await prisma.leaveRequest.update({
                where: { id: leaveRequestId },
                data: { currentApprovalId: firstApproval.id },
            });

            // Send notification outside transaction
            // setTimeout(() => {
            //     this.sendLeaveRequestMail(leaveRequestId).catch(console.error);
            // }, 0);
        }

        return firstApproval;
    }

    async approveLeaveRequest(approvalId: string, approverId: string, note?: string) {
        try {
            await this.prisma.$transaction(async (tx) => {
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
                    bad('Approval not found');
                }

                // Check if the user can approve this request
                const canApprove = await this.approver.canUserApprove(approverId, approval.leaveRequest.userId);

                if (!canApprove) {
                    bad('You are not authorized to approve this request');
                }

                if (approval.status !== 'PENDING') {
                    bad('This request has already been processed');
                }

                // Approve current phase
                await tx.approval.update({
                    where: { id: approvalId },
                    data: {
                        status: 'APPROVED',
                        note: note,
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


                }

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
            });


        } catch (error) {
            // if (error instanceof BadRequestException ||
            //     error instanceof NotFoundException ||
            //     error instanceof ConflictException) {
            //     throw error;
            // }
            bad('Failed to approve leave request: ' + error.message);
        }
    }

    async rejectLeaveRequest(approvalId: string, approverId: string, note: string) {
        try {
            // const approverId = approver.sub;
            return this.prisma.$transaction(async (tx) => {
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
                    where: { id: approvalId },
                    data: {
                        status: 'REJECTED',
                        actionDate: new Date(),
                        note: note,
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
                    this.sendRejectionMail(approval.leaveRequestId, note).catch(console.error);
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

    async deleteRequest(id: string, userId: string) {
        try {
            const request = await this.prisma.leaveRequest.findUnique(
                {
                    where: {
                        id,
                        userId
                    },

                }
            )

            if (!request) mustHave(request, "Request not found", 404)

            if (request.userId !== userId) bad("You can only delete your request.")

            await this.prisma.leaveRequest.delete({
                where: {
                    id
                }
            })

            return {
                message: "Requst deleted successfully"
            }
        } catch (error) {
            bad(error)
        }
    }



    //     /////////////////////////////////////// HELPERS ////////////////////////////////////////
    private calculateLeaveDuration(startDate: Date, endDate: Date): number {
        try {
            if (!startDate || !endDate) {
                throw bad("Start date and end date are required");
            }

            if (startDate > endDate) {
                throw bad("Start date cannot be after end date");
            }

            // Normalize to midnight (prevents partial-day issues)
            let currentDate = new Date(startDate);
            currentDate.setHours(0, 0, 0, 0);
            const finalDate = new Date(endDate);
            finalDate.setHours(0, 0, 0, 0);

            let businessDays = 0;

            while (currentDate <= finalDate) {
                const weekDay = currentDate.getDay();
                // Exclude weekends: 0 = Sunday, 6 = Saturday
                if (weekDay !== 0 && weekDay !== 6) {
                    businessDays++;
                }
                // Move to next day
                currentDate.setDate(currentDate.getDate() + 1);
            }

            return businessDays;
        } catch (error: any) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException
            ) {
                throw error;
            }
            throw new BadRequestException("Failed to calculate leave duration: " + error.message);
        }
    }


    private async createApprovalStep(
        leaveRequestId: string,
        phase: number,
        approverId: string,
        prisma: PrismaClient | Prisma.TransactionClient = this.prisma
    ) {
        // const approver = await prisma.approver.findFirst({
        //     where: { userId: approverId, isActive: true },
        // });

        // if (!approver) {
        //     throw new NotFoundException(`Approver with user ID ${approverId} not found or inactive`);
        // }

        return prisma.approval.create({
            data: {
                leaveRequestId,
                phase,
                approverId,
                status: "PENDING",
            },
            include: {
                approver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });
    }

    private async findEmployee(userId: string) {
        try {
            const employee = await this.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    requests: true,
                    departments: true,
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
            if (!employee) {
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
                email: currentApproval.approver.email,
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
            email: approval.user.email,
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
            email: leaveRequest.user.email,
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