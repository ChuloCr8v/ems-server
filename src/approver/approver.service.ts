import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Department, Role } from '@prisma/client';

@Injectable()
export class ApproverService {
  constructor(private readonly prisma: PrismaService) { }

  async getApproversForDepartment(departments: Department[]) {
    const deptIds = departments.map((d) => d.id);

    return this.prisma.user.findMany({
      where: {
        departments: {
          some: { id: { in: deptIds } },
        },
        approver: {
          some: {
            departmentId: { in: deptIds },
            role: Role.DEPT_MANAGER,
          },
        }

      },
      include: {
        departments: true,
        approver: true
      },
    });
  }


  async getGlobalApprovers() {
    return this.prisma.user.findMany({
      where: {
        userRole: {
          has: Role.ADMIN
        },
      },
    });
  }

  async getApproversForUser(userId: string) {
    // Get user with department info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        departments: {
          include: {
            departmentHead: true
          }
        }
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isDepartmentHead = user.departments?.some(d => d.departmentHeadId === userId);

    if (isDepartmentHead) {
      // Department heads need different approval logic
      return await this.getApproversForDepartmentHead();
    }

    // Regular employees get department approvers + global approvers
    const departmentApprovers = user.departments
      ? await this.getApproversForDepartment(user.departments)
      : [];

    const globalApprovers = await this.getGlobalApprovers();


    return [...departmentApprovers, ...globalApprovers];
  }

  private async getApproversForDepartmentHead() {
    // For department heads, they typically need approval from:
    // 1. Another department head (peer)
    // 2. HR (global approver)

    const globalApprovers = await this.getGlobalApprovers();

    return globalApprovers
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
        user: true
      },
    });


    if (!approver) {
      return false;
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        departments: {
          include: {
            departmentHead: true
          }
        }
      },
    });



    if (!targetUser) {
      return false;
    }

    const isTargetDepartmentHead = targetUser.departments?.some(d => d.departmentHeadId === targetUserId)


    // If approver is global (ADIMN, etc.), they can approve anyone
    if (approver.user.userRole.includes(Role.ADMIN)) {
      return true;
    }

    // Department heads can approve anyone in their department
    if (targetUser.departments?.some(d => d.departmentHeadId === targetUserId)) {
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