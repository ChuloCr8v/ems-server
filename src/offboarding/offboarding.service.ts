import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { ClearanceType, Role, SignatureRole, Status } from '@prisma/client';
import { bad } from 'src/utils/error.utils';
import { MailService } from 'src/mail/mail.service';
import { BulkReturnDto, DepartmentClearanceDto, FinanceClearanceDto, HandoverTaskDto, InitiateExit, ReportAssetDto, SignDto, UploadHandoverSignatureDto } from './dto/offboarding.dto';
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
          initiatedById: userId,
          userId: employeeId,
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

      await this.prisma.user.update({
        where: { id: employeeId },
        data: { isOffboarding: true },
      });

      return { exit };
    } catch (error) {
      console.log(error);
      bad(`Failed to initiate offboarding: ${error.message}`);
    }
  }
  
  //////////////////////////////// DEPARTMENT CLEARANCE ////////////////////////////////////////////////

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
      const { toUserId, note, uploads, signatureId } = data;

      const tasks = await this.getTasksForHandover(userId);
      if (!tasks.length) {
        throw bad("No non-completed tasks found for handover");
      }

      const clearance = await this.prisma.clearance.findFirst({
        where: {
          offboarding: { userId },
          type: "DEPARTMENT",
        },
        include: { department: true },
      });

      if (!clearance) {
        throw bad("Department clearance not found for user's offboarding");
      }

      const deptClearanceId =
        clearance.department?.id ??
        (
          await this.prisma.departmentClearance.create({
            data: {
              clearance: { connect: { id: clearance.id } },
            },
          })
        ).id;

      await this.prisma.$transaction(async (tx) => {
        // Update receiver role once
         tx.user.update({
          where: { id: toUserId },
          data: { userRole: { push: Role.RECEIVER } },
        });

         // Extract assignments belonging to the current user
        const assignments = tasks
          .map(task => ({
            taskId: task.id,
            assignment: task.assignees.find(
              a => a.userId === userId
            )
          }))
          .filter(item => item.assignment);

         // Batch operations
         
        await Promise.all([

           // Create task handovers
          ...assignments.map(({ taskId }) =>
            tx.taskHandover.create({
              data: {
                note,
                task: { connect: { id: taskId } },
                fromUser: { connect: { id: userId } },
                toUser: { connect: { id: toUserId } },
                clearance: { connect: { id: deptClearanceId } },
                upload: uploads
                  ? {
                      connect: uploads.map(id => ({ id })),
                    }
                  : undefined,
              },
            })
          ),

           // Update assignments
          ...assignments.map(({ assignment }) =>
            tx.userTask.update({
              where: { id: assignment!.id },
              data: { userId: toUserId },
            })
          ),

           // Mark tasks as transferred
          ...assignments.map(({ taskId }) =>
            tx.task.update({
              where: { id: taskId },
              data: { hasTransfer: true },
            })
          ),

           // Save signature
          tx.signatures.create({
            data: {
              clearanceId: clearance.id,
              role: "USER",
              userId,
              uploadId: signatureId,
              signedAt: new Date(),
            },
          }),

          //Update clearance status
          tx.clearance.update({
            where: { id: clearance.id },
            data: {
              status: 'USER_SIGNED',
            }
          }),
        ]);
      });

       // Emit workflow event
      this.eventEmitter.emit(
        "taskHandover.signatureRequested",
        new TaskHandoverSignatureRequestedEvent(
          userId,
          toUserId,
          tasks[0].id,
          clearance.offboardingId
        )
      );

      return {
        message: "Tasks handed over successfully",
        count: tasks.length,
      };

    } catch (error) {
      console.error(error);
      throw bad(`Failed to initiate task handover: ${error.message}`);
    }
  }

  async getHandoverDocuments(employeeId: string, managerId: string) {
    try {
      const employee = await this.findUserById(employeeId)
      const manager = this.isManagerOfUser(managerId, employee.id);
      if(!manager) throw bad("You are not authorised to view this documents")
      return await this.prisma.taskHandover.findMany({
        where: { fromUserId: employeeId },
        select: { upload: true },
      })
    } catch (error) {
      console.log(error);
      bad(`Failed to fetch handed-over documents: ${error.message}`);
    }
  }

  async getHandover(userId: string) {
    try {

      const user = await this.findUserById(userId);

      const isUser = this.userHasRole(user, Role.USER);
      const isManager = this.userHasRole(user, Role.DEPT_MANAGER);
      const isReceiver = this.userHasRole(user, Role.RECEIVER);

      const managerDeptIds =
        user.departments?.map(dept => dept.id) || [];

      const filters = [];

      if (isUser) {
        filters.push({
          fromUserId: userId
        });
      }

      if (isReceiver) {
        filters.push({
          task: {
            assignees: {
              some: {
                userId: userId
              }
            }
          }
       });
      }

      if (isManager && managerDeptIds.length > 0) {
        filters.push({
          task: {
            departmentId: {
              in: managerDeptIds
            }
          }
        });
      }

      if (!filters.length) {
        throw bad("You are not authorised to view this information");
      }

      return await this.prisma.taskHandover.findMany({
        where: {
          OR: filters
        },
        include: {
          task: true,
          clearance: {
            include: {
              clearance: {
                include: {
                  signatures: true
                }
              }
            }
          },
          upload: true,
          fromUser: true,
          toUser: true,
        }
      });

    } catch (error) {
      console.log(error);
      throw bad(
        `Failed to get handover details: ${error.message}`
      );
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

  async receiverSignature(userId: string, data: UploadHandoverSignatureDto) {
    try {
      const { signatureId } = data;
      // Step 1: Fetch all tasks that were handed over to this user from the specified sender
      const handovers = await this.getHandover(userId);
      if (!handovers || handovers.length === 0) {
        throw bad("No tasks were handed over to you from this user");
      }

      // Step 2: Find the associated DepartmentClearance from one of the handover records
      const handoverWithClearance = handovers.find((h) => h.clearanceId !== null);
      if (!handoverWithClearance) {
        throw bad("No department clearance is linked to these task handovers");
      }

      const clearanceId = handoverWithClearance.clearance?.clearanceId;
      if(!clearanceId) {
        throw bad("Associated clearance record not found for these task handovers");
      }

      // Step 3: Ensure no handover e-signature has already been recorded
      const existing = await this.prisma.signatures.findUnique({
        where: {
          clearanceId_role: {
            clearanceId: clearanceId,
            role: "RECEIVER",
          },
          userId: userId
        },
      });
      if (existing) {
        throw bad("Handover acceptance signature has already been uploaded");
      }

      // Step 4: Record the receiver's e-signature as acceptance of the handover
      await this.signClearance(userId, {
        clearanceId: clearanceId,
        role: "RECEIVER",
        uploadId: signatureId,
      });

      //Step 5: Record clearance status update
      await this.prisma.clearance.update({
        where: { id: clearanceId },
        data: {
          status: 'RECEIVER_SIGNED',
        }
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
      const isManager = this.isManagerOfUser(userId, managerId);
      if (!isManager) throw bad("User is not a department manager");

      await this.validateDepartmentClearance(userId);

      const { deptClearanceId, clearanceId } = await this.findUserClearance(userId, notes); 

      //Confirm that the fromUser and toUser have already uploaded their signatures
      const signatures = await this.prisma.signatures.findMany({
        where: {
          clearanceId: clearanceId,
          role: { in: ["USER"] },
        }
      });
      
      const hasUserSig = signatures.some(s => s.role === "USER");
      if (!hasUserSig) throw bad("Employee signature has not been uploaded");

      await this.prisma.signatures.create({
        data: {
          clearanceId: clearanceId,
          role: "DEPT_MANAGER",
          userId: managerId,
          uploadId: signatureId,
          signedAt: new Date()
        }
      });

      await this.prisma.clearance.update({
        where: { id: clearanceId },
        data: {
          status: 'DM_SIGNED',
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

  async completeDepartmentClearance(userId: string, clearanceId: string) {

    try {

      const user = await this.findUserById(userId);

      if (!user) throw bad("User not found");

      const clearance = await this.findClearanceById(clearanceId);

      if (!clearance) throw bad("Clearance Not Found");

      if (clearance.type !== "DEPARTMENT") {
        throw bad("Invalid clearance type");
      }

      // Ensure tasks handed over

      const deptClearance = clearance.department;

      if (!deptClearance?.tasksHandedOver) {
        throw bad("Tasks must be handed over before completing clearance");
      }

    // Validate signatures

      const signatures = clearance.signatures;

      const signedRoles = new Set(signatures.map(s => s.role));

      const requiredRoles: SignatureRole[] = ["USER", "DEPT_MANAGER", "RECEIVER"];

      const missingRoles = requiredRoles.filter(role => !signedRoles.has(role));

        if (missingRoles.length > 0) {
          throw bad(
            `Missing required signatures: ${missingRoles.join(", ")}`
          );
        }

    // Authorization check
      const canComplete = this.userHasRole(user, Role.DEPT_MANAGER)
        if (!canComplete) {
          throw bad("You are not authorized to complete this clearance");
        }

    // Complete clearance
        return await this.prisma.clearance.update({
          where: { id: clearanceId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });

    } catch (error) {

      console.log(error);

      throw bad(`Failed to complete department clearance: ${error.message}`);

    }
 }

  async getReceiverHandover(userId: string) {
      console.log("User ID:", userId);

      const receiverRecords =
        await this.prisma.taskHandover.findMany({
          where: {
            toUserId: userId
          }
        });

      console.log("Receiver records:", receiverRecords);
  }

  //////////////////////////////////////// FINANCE CLEARANCE //////////////////////////////////////////

  // async initiateFinanceClearance(employeeId: string, data: FinanceClearanceDto) {
  //   try {
  //     const { isLoan, isReimbursement, isTravel, travelAmount, loanAmount, reimburseAmount } = data;
  //     const employee = await this.findUserById(employeeId);
  //     if(!employee) throw bad("Employee not found");

  //     //Check if user has completed department clearance
  //     const clearance = await this.prisma.clearance.findFirst({
  //       where: {
  //         type: 'DEPARTMENT',
  //         offboarding: { userId: employeeId },
  //         status: 'COMPLETED',
  //       },
  //     });
  //     if(!clearance) throw bad("Department clearance must be completed before intiating finance clearance");

  //     //Initiate finance clearance
  //     const finance = await this.prisma.clearance.create({
  //       data: {
  //         type: 'FINANCE',
  //         offboarding: { connect: { userId: employeeId } },
  //         finance: {
  //           create: {
  //             employee: { connect: { id: employeeId } },
  //             travelAmount,
  //             isTravel,
  //             isLoan,
  //             loanAmount,
  //           },
  //         },
  //       },
  //     });
  //   } catch (error) {
  //     console.log(error);
  //     bad(`Failed to initiate finance clearance: ${error.message}`);
  //   }
  // }

  ////////////////////////////// FACILITY CLEARANCE ////////////////////////////////////////
  async bulkReturnAssets(userId: string, data: BulkReturnDto){
    try {
       //Check if user has completed department clearance
      const clearance = await this.prisma.clearance.findFirst({
        where: {
          type: 'DEPARTMENT',
          offboarding: { userId },
          status: 'COMPLETED',
        },
      });
      if(!clearance) throw bad("Department clearance must be completed before intiating facility clearance");

      const { assignmentIds } = data;
      if(!assignmentIds || assignmentIds.length === 0) {
        throw bad("No assets selected for return");
      }

      //Fetch assignments to validate ownership
      const assignments = await this.prisma.assignment.findMany({
        where: {
          id: { in: assignmentIds },
          userId,
          status: "ASSIGNED",
          returnedAt: null,
        },
      });
      if(assignments.length === 0) {
        throw bad("No valid assigned asset found");
      }

      await this.prisma.$transaction(async(tx) => {
        for(const assignment of assignments) {
          await tx.assignment.update({
            where: { id: assignment.id },
            data: {
              returnedAt: new Date(),
              status: "RETURNED",
              isReturned: true
            },
          });
        }
      });
      return {
        message: "Assets returned successfully",
        count: assignments.length,
      };
    } catch (error) {
      console.log(error);
      bad(`Bulk return failed: ${error.message}`);
    }
  }

  async reportAsset(managerId: string, assignmentId: string, data: ReportAssetDto) {
    try {
      const { status, liabilityCost, description } = data;
      const assignment = await this.prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          asset: true, 
          facility: true, 
          user: true,
        },
      });

      if(!assignment) throw bad("Assignment Not Found");
      if(assignment.status !== 'RETURNED') {
        throw bad("Asset has to be returned before assessment");
      }
      const reviewAssignment = await this.prisma.assetAssesment.create({
        data: {
          assignmentId: assignmentId,
          status,
          description,
          liabilityCost,
          assessedById: managerId,
          assessedAt: new Date()
        }
      })

      await this,this.prisma.assignment.update({
        where: { id: assignmentId },
        data: {
          condition: status,
          notes: description
        }
      })
      return reviewAssignment;
    } catch (error) {
      console.log(error);
      bad(`Failed to review facility clearance: ${error.message}`);
    }
  }

  async sendLiabiltyCosts(aaId: string, userId: string) {
    try {
      const assetAssessment = await this.prisma.assetAssesment.findUnique({
        where: { id: aaId },
      });
      if(!assetAssessment) throw bad("Asset Assessment Not Found");
    } catch (error) {
      console.log(error);
      bad(`Failed to send liability costs: ${error.message}`);
    }
  }

  async facilityClearance(managerId: string, userId: string) {}

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

  async signClearance(userId: string, data: SignDto){
    try {
      const { clearanceId, role, uploadId } = data;

      const clearance = await this.prisma.clearance.findUnique({
        where: { id: clearanceId },
      });
      if(!clearance) throw bad("Clearance not found");

      //Validate role allowed
      this.validateRole(clearance.type, role);

      return this.prisma.signatures.create({
        data: {
          clearanceId,
          role,
          userId,
          uploadId
        },
      });

    } catch (error) {
       console.log(error);
      bad(`Failed to sign clearance for user: ${error.message}`);
    }
  }

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

  private validateRole(clearanceType: ClearanceType, role: SignatureRole) {
  const rules = {
    DEPARTMENT: ["USER", "DEPT_MANAGER", "RECEIVER"],
    FACILITY: ["USER", "ASSET_MANAGER"],
    FINANCE: ["USER", "HR"]
  };

  if (!rules[clearanceType].includes(role)) {
      throw bad(`Role ${role} not allowed for ${clearanceType}`);
    }
  }

  private async findUserClearance(userId: string, notes?: string) {
    try {
      const clearance = await this.prisma.clearance.findFirst({
        where: {
          type: 'DEPARTMENT',
          offboarding: { userId },
        },
        include: {
          department: true,
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

   private async findClearanceById(clearanceId: string) {
    try {
      const clearance = await this.prisma.clearance.findUnique({
        where: { id: clearanceId },
        include: {
          department: true,
          finance: true,
          facility: true,
          signatures: true,
          offboarding: true,
        }
      });
      if(!clearance) throw bad("Clearance Not Found");
      return clearance;
    } catch (error) {
      console.log(error);
      bad(`Failed to find clearance by ID: ${error.message}`);
    }
  }

   private async isManagerOfUser(userId: string, employeeId: string) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { departments: { include: { approver: true } } },
      });
      if (this.userHasRole(user, Role.DEPT_MANAGER)) {
        //Check if employee is in any of the manager's departments
        const managedDeptIds = user.departments.map((dept) => dept.id);
        const employee = await this.prisma.user.findUnique({
          where: { id: employeeId },
          include: { departments: true },
        });
        const employeeDeptIds = employee.departments.map((dept) => dept.id);
        const commonDepts = managedDeptIds.filter((id) =>
          employeeDeptIds.includes(id),
        );
        return commonDepts.length > 0;
      }
    }

  // private async findUserAssets(userId: string) {
  //   try {
  //     const user = await this.findUserById(userId);
  //     if (!user) throw bad("User Not Found");

  //     const assets = await this.prisma.asset.findMany({
  //       where: {
  //         assignments: {
  //           some: { userId: user.id, returnedAt: null },
  //         },
  //       },
  //     });
  //     return assets;
  //   } catch (error) {
  //     console.log(error);
  //     bad(`Failed to get user: ${error.message}`);
  //   }
  // }
}
