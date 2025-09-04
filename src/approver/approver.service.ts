import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class ApproverService {
  constructor(private readonly prisma: PrismaService) {}

  async getApproversForDepartment(departmentId: string) {
    return this.prisma.approver.findMany({
      where: {
        departmentId,
        isActive: true,
      },
      include: {
        user: true,
        department: true,
      },
    });
  }

  async getGlobalApprovers() {
    return this.prisma.approver.findMany({
      where: {
        departmentId: null,
        isActive: true,
      },
      include: {
        user: true,
      },
    });
  }

    async getApproversForUser(userId: string) {
        // Get user with department info
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { 
                department: {
                    include: {
                        departmentHead: true
                    }
                } 
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const isDepartmentHead = user.department?.departmentHeadId === userId;
        
        if (isDepartmentHead) {
            // Department heads need different approval logic
            return await this.getApproversForDepartmentHead(userId, user.departmentId);
        }

        // Regular employees get department approvers + global approvers
        const departmentApprovers = user.departmentId 
            ? await this.getApproversForDepartment(user.departmentId)
            : [];

        const globalApprovers = await this.getGlobalApprovers();

        return [...departmentApprovers, ...globalApprovers];
    }

  private async getApproversForDepartmentHead(departmentHeadId: string, departmentId: string) {
    // For department heads, they typically need approval from:
    // 1. Another department head (peer)
    // 2. HR (global approver)
    
    const peerApprovers = await this.prisma.approver.findMany({
        where: {
            role: 'DEPT_MANAGER',
            departmentId: {
                not: departmentId // Other departments
            },
            isActive: true
        },
        include: {
            user: true,
            department: true
        }
    });

    const globalApprovers = await this.getGlobalApprovers();
    

    return [...peerApprovers, ...globalApprovers ];
}

    async canUserApprove(approverUserId: string, targetUserId: string): Promise<boolean> {
        // Prevent self-approval
        if (approverUserId === targetUserId) {
            return false;
        }

        const approver = await this.prisma.approver.findFirst({
            where: {
                userId: approverUserId,
                isActive: true,
            },
            include: {
                department: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        if (!approver) {
            return false;
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            include: { 
                department: {
                    include: {
                        departmentHead: true
                    }
                } 
            },
        });

        if (!targetUser) {
            return false;
        }

        const isTargetDepartmentHead = targetUser.department?.departmentHeadId === targetUserId;

        // If approver is global (HR, etc.), they can approve anyone
        if (!approver.departmentId) {
            return true;
        }

        // Department heads can approve anyone in their department
        if (approver.role === 'DEPT_MANAGER' && targetUser.departmentId === approver.departmentId) {
            return true;
        }

        // Special case: Peer department heads can approve each other
        if (isTargetDepartmentHead && approver.role === 'DEPT_MANAGER') {
            return true; // Department head approving another department head
        }

        return false;
    }

  async createApprover(userId: string, departmentId: string | null, role: Role) {
    return this.prisma.approver.create({
      data: {
        userId,
        departmentId,
        role,
      },
      include: {
        user: true,
        department: true,
      },
    });
  }

  async deactivateApprover(approverId: string) {
    return this.prisma.approver.update({
      where: { id: approverId },
      data: { isActive: false },
    });
  }
}