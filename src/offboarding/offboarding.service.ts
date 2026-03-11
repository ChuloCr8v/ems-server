import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { Role, Status } from '@prisma/client';
import { bad } from 'src/utils/error.utils';
import { MailService } from 'src/mail/mail.service';
import { DepartmentClearanceDto, HandoverTaskDto, InitiateExit } from './dto/offboarding.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskHandoverSignatureRequestedEvent } from 'src/events/offboarding';

@Injectable()
export class OffboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly user: UserService,
    private readonly mail: MailService,
    private eventEmitter: EventEmitter2,
  ) { }

  async initiateExit(userId: string, data: InitiateExit) {
    const { employeeId, type, reason, relievingDate, resignationDate, noticePeriod } = data;

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
          relievingDate,
          resignationDate,
          noticePeriod,
          initiatedBy: { connect: { id: userId } },
          user: { connect: { id: employeeId } },
          clearance: {
            create: [
              { type: 'DEPARTMENT' },
              { type: 'FINANCE' },
              { type: 'FACILITIES' },
            ],
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

      return { exit };
    } catch (error) {
      console.log(error);
      bad(`Failed to initiate offboarding: ${error.message}`);
    }
  }

  async getTasksForHandover(userId: string) {
    try {
      return await this.prisma.task.findMany({
        where: {
          assignees: { some: { userId: userId } },
          status: { not: 'COMPLETED' },
          // createdById: userId,
        },
        include: { assignees: true, }
      });
    } catch (error) {
      console.log(error);
      bad(`Failed to get tasks for handover: ${error.message}`);
    }
  }

  async taskHandOver(userId: string, data: HandoverTaskDto) {
    try {
      const user = await this.findUserById(userId);
      if (!user) throw bad("User Not Found");

      const { toUserId, note, uploads, signatureId } = data;

      const tasks = await this.getTasksForHandover(userId);
      if (tasks.length === 0) throw bad("No non-completed tasks found for handover");

      const clearance = await this.prisma.clearance.findFirst({
        where: {
          offboarding: { userId },
          type: 'DEPARTMENT',
        },
        include: {
          departmentClearance: true,
        }
      });

      if (!clearance) throw bad("Department clearance not found for user's offboarding");

      let deptClearanceId = clearance.departmentClearance?.id;
      if (!deptClearanceId) {
        const dc = await this.prisma.departmentClearance.create({
          data: {
            clearance: { connect: { id: clearance.id } },
          }
        });
        deptClearanceId = dc.id;
      }

      await this.prisma.$transaction(async (tx) => {
        for (const task of tasks) {
          const assignment = task.assignees.find(a => a.userId === userId);
          if (!assignment) continue;

          await tx.taskHandover.create({
            data: {
              note,
              task: { connect: { id: task.id } },
              fromUser: { connect: { id: user.id } },
              toUser: { connect: { id: toUserId } },
              clearance: { connect: { id: deptClearanceId } },
              upload: uploads
                ? { connect: uploads.map((id) => ({ id })) }
                : undefined,
            },
          });

          //Update task assignments
          await tx.userTask.update({
            where: { id: assignment.id },
            data: { userId: toUserId },
          });

          //Update task history
          await tx.task.update({
            where: { id: task.id },
            data: { hasTransfer: true },
          });
        }

        await tx.clearanceDeptSignatures.create({
          data: {
            signature: { connect: { id: signatureId } },
            signedAt: new Date(),
            employeeSignature: { connect: { id: deptClearanceId } }
          }
        });
      });

      this.eventEmitter.emit(
        'taskHandover.signatureRequested',
        new TaskHandoverSignatureRequestedEvent(userId, toUserId, tasks[0].id, clearance.offboardingId)
      );

      return { message: "Tasks handed over successfully", count: tasks.length };
    } catch (error) {
      console.log(error);
      bad(`Failed to initiate task handover: ${error.message}`);
    }
  }

  async tasksHandoverReceiver(fromUserId: string, toUserId: string) {
    try {
      // Fetch all handover records where the current user is the recipient
      const handovers = await this.prisma.taskHandover.findMany({
        where: {
          fromUserId,
          toUserId,
        },
        include: {
          task: true,
          clearance: true,
        },
      });

      return handovers;
    } catch (error) {
      console.log(error);
      bad(`Failed to fetch handed-over tasks: ${error.message}`);
    }
  }

  async validateDepartmentClearance(userId: string) {
    try {
      const remainingTasks = await this.prisma.task.count({
        where: {
          assignees: {
            some: { userId }
          },
          status: {
            not: "COMPLETED"
          }
        }
      });

      if (remainingTasks > 0) {
        throw new BadRequestException(
          "All tasks must be transferred before department clearance"
        );
      }

      return true;
    } catch (error) {
      console.log(error);
      bad(`Failed to validate department clearance: ${error.message}`);
    }
  }

  async uploadHandoverESignature(userId: string, fromUserId: string, signatureId: string) {
    try {
      // Step 1: Fetch all tasks that were handed over to this user from the specified sender
      const handovers = await this.tasksHandoverReceiver(fromUserId, userId);
      if (!handovers || handovers.length === 0) {
        throw bad("No tasks were handed over to you from this user");
      }

      // Step 2: Find the associated DepartmentClearance from one of the handover records
      const handoverWithClearance = handovers.find((h) => h.clearanceId !== null);
      if (!handoverWithClearance) {
        throw bad("No department clearance is linked to these task handovers");
      }

      // Step 3: Ensure no handover e-signature has already been recorded
      const existing = await this.prisma.clearanceDeptSignatures.findFirst({
        where: { handoverESignatureId: handoverWithClearance.clearanceId },
      });
      if (existing) {
        throw bad("Handover acceptance signature has already been uploaded");
      }

      // Step 4: Record the receiver's e-signature as acceptance of the handover
      await this.prisma.clearanceDeptSignatures.create({
        data: {
          signature: { connect: { id: signatureId } },
          signedAt: new Date(),
          handoverESignature: { connect: { id: handoverWithClearance.clearanceId } },
        },
      });

      return {
        message: "Handover acceptance signature uploaded successfully",
        tasksAccepted: handovers.length,
      };
    } catch (error) {
      console.log(error);
      bad(`Failed to upload handover signature: ${error.message}`);
    }
  }

  async departmentClearance(userId: string, managerId: string, data: DepartmentClearanceDto) {
    try {
      const { notes, signatureId } = data;

      const manager = await this.user.__findUserById(managerId);
      const isManager = this.userHasRole(manager, Role.DEPT_MANAGER);
      if (!isManager) throw bad("User is not a department manager");

      await this.validateDepartmentClearance(userId);

      //Confirm that the fromUser and toUser have already uploaded their signatures
      const signatures = await this.prisma.departmentClearance.findFirst({
        where: {
          employeeSignature: { isNot: null },
          handoverESignature: { isNot: null },
        }
      });
      if (!signatures) throw bad("Employee signature has not been uploaded");

      const { deptClearanceId, clearanceId } = await this.findUserClearance(userId, notes); 

      await this.prisma.clearanceDeptSignatures.create({
        data: {
          signature: { connect: { id: signatureId } },
          signedAt: new Date(),
          managerSignature: { connect: { id: deptClearanceId } }
        }
      });

      await this.prisma.clearance.update({
        where: { id: clearanceId },
        data: {
          status: 'COMPLETED',
          approvedBy: managerId,
          approvedAt: new Date(),
        }
      });

      return { message: "Department clearance completed successfully" };

    } catch (error) {
      console.log(error);
      bad(`Failed to complete department clearance: ${error.message}`);
    }
  }

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

  ///////////////////////////////////////  HELPERS /////////////////////////////////////////
  private async findUserById(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { departments: true, approver: true, },
      });
      return user;
    } catch (error) {
      console.log(error);
      bad(`Failed to get user: ${error.message}`);
    }
  }

  private userHasRole(userObj: any, role: Role) {
    if (!userObj) return false;
    // userObj.userRole may be an array of Role or a single Role string
    const roles = (userObj.userRole ?? userObj.role) as any;
    if (Array.isArray(roles)) return roles.includes(role);
    return roles === role;
  }

  private async findUserClearance(userId: string, notes?: string) {
    try {
      const clearance = await this.prisma.clearance.findFirst({
        where: {
          type: 'DEPARTMENT',
          offboarding: { userId },
        },
        include: {
          departmentClearance: true,
        },
      });
      if (!clearance) throw bad("Department clearance not found for user's offboarding");

      const dc = await this.prisma.departmentClearance.upsert({
        where: { clearanceId: clearance.id },
        update: {
          tasksHandedOver: true,
          clearedAt: new Date(),
          notes,
        },
        create: {
          clearance: { connect: { id: clearance.id } },
          tasksHandedOver: true,
          clearedAt: new Date(),
          notes,
        },
      });
      return { deptClearanceId: dc.id, clearanceId: clearance.id };
    } catch (error) {
      console.log(error);
      bad(`Failed to find user clearance: ${error.message}`);
    }
  }

  private async findUserAssets(userId: string) {
    try {
      const user = await this.findUserById(userId);
      if (!user) throw bad("User Not Found");

      const assets = await this.prisma.asset.findMany({
        where: {
          assignments: {
            some: { userId: user.id, returnedAt: null },
          },
        },
      });
      return assets;
    } catch (error) {
      console.log(error);
      bad(`Failed to get user: ${error.message}`);
    }
  }
}
