import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Department, Role } from '@prisma/client';

@Injectable()
export class ApproverService {
  constructor(private readonly prisma: PrismaService) { }

  async getApproversForDepartment(departments: Department[]) {
    const deptIds = departments.map((d) => d.id);

    const approver = this.prisma.user.findMany({
      where: {
        approver: {
          some: {
            departmentId: { in: deptIds },
            role: Role.DEPT_MANAGER,
          },
        },
      },
      include: {
        departments: true,
        approver: true,
      },
    });

    console.log(approver)

    return approver


  }

  async getGlobalApprovers() {
    return this.prisma.user.findMany({
      where: {
        userRole: {
          has: Role.LEAVE_MANAGER
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
            approver: {
              include: {
                user: true
              }
            }
          }
        },
        approver: true
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isDepartmentHead = user.approver.length

    if (isDepartmentHead) {
      // Department heads need different approval logic
      return await this.getApproversForDepartmentHead();
    }

    // Regular employees get department approvers + global approvers
    const departmentApprovers = await this.getApproversForDepartment(user.departments)
      ?? [];

    const globalApprovers = await this.getGlobalApprovers();

    return [...departmentApprovers, ...globalApprovers];
  }

  private async getApproversForDepartmentHead() {

    const globalApprovers = await this.getGlobalApprovers();

    return globalApprovers
  }

  async canUserApprove(approverUserId: string, targetUserId: string): Promise<boolean> {
    // Prevent self-approval
    if (approverUserId === targetUserId) return false;

    // Fetch approver user with roles + departments
    const approverUser = await this.prisma.user.findUnique({
      where: { id: approverUserId },
      include: {
        departments: true,
        approver: true,
      },
    });

    if (!approverUser) return false;

    // Fetch target user with departments + approver info
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        departments: true,
        approver: true,
      },
    });

    if (!targetUser) return false;

    // 1. Leave manager can approve anyone
    if (approverUser.userRole.includes(Role.LEAVE_MANAGER)) return true;

    // 2. Department approvers can approve members of their department
    const approverDeptIds = approverUser.departments.map(d => d.id);
    const targetDeptIds = targetUser.departments.map(d => d.id);

    const isSameDepartment = targetDeptIds.some(id => approverDeptIds.includes(id));
    if (isSameDepartment) return true;

    // 3. Peer department heads can approve each other
    const isTargetDepartmentHead = targetUser.approver.length > 0;
    const isApproverDepartmentHead = approverUser.approver.some(a => a.role === 'DEPT_MANAGER');

    if (isTargetDepartmentHead && isApproverDepartmentHead) return true;

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