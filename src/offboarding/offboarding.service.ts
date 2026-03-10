import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
// import { CommentsDto, DebtPaymentDto, HandoverDto, HandoverDto, InitiateExit, NotesDto, OffboardingCommentsDto, ReturnAsset } from './dto/offboarding.dto';
import { UserService } from 'src/user/user.service';
import { Role, Status } from '@prisma/client';
import { bad } from 'src/utils/error.utils';
import { IAuthUser } from 'src/auth/dto/auth.dto';
import { MailService } from 'src/mail/mail.service';
import { UploadValidationUtil } from 'src/utils/uploads.utils';
import { HandoverTaskDto, InitiateExit } from './dto/offboarding.dto';
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

  async uploadHandoverESignature(userId: string, handoverUserId: string, signatureId: string) {
    try {
      // Find the specific task handover(s) involving this handing over user and the specific receiver
      const handover = await this.prisma.taskHandover.findFirst({
        where: {
          fromUserId: userId,
          toUserId: handoverUserId,
          clearanceId: { not: null }
        }
      });
      if (!handover) throw bad("Task handover not found between these users");

      await this.prisma.clearanceDeptSignatures.create({
        data: {
          signature: { connect: { id: signatureId } },
          signedAt: new Date(),
          handoverESignature: { connect: { id: handover.clearanceId } }
        }
      });

      return { message: "Handover signature uploaded successfully" };
    } catch (error) {
      console.log(error);
      bad(`Failed to upload handover signature: ${error.message}`);
    }
  }

  async departmentClearance(userId: string, managerId: string, data: { notes?: string, signatureId: string }) {
    try {
      const manager = await this.user.__findUserById(managerId);
      const isManager = this.userHasRole(manager, Role.DEPT_MANAGER);
      if (!isManager) throw bad("User is not a department manager");

      await this.validateDepartmentClearance(userId);

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
            tasksHandedOver: true,
            clearedAt: new Date(),
            notes: data.notes,
          }
        });
        deptClearanceId = dc.id;
      } else {
        await this.prisma.departmentClearance.update({
          where: { id: deptClearanceId },
          data: {
            tasksHandedOver: true,
            clearedAt: new Date(),
            notes: data.notes,
          }
        });
      }

      await this.prisma.clearanceDeptSignatures.create({
        data: {
          signature: { connect: { id: data.signatureId } },
          signedAt: new Date(),
          managerSignature: { connect: { id: deptClearanceId } }
        }
      });

      await this.prisma.clearance.update({
        where: { id: clearance.id },
        data: {
          status: 'APPROVED',
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