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
      bad(`Failed to initiate offboarding: ${error instanceof Error ? error.message : String(error)}`);
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
        bad(`Failed to get tasks for handover: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    async taskHandOver(userId: string, data: HandoverTaskDto) {
    try {
      const user = await this.findUserById(userId);
      const { toUserId, note, fileLink, fileName, signatureId } = data;

      const tasks = await this.getTasksForHandover(userId);
      if (!tasks.length) {
        throw bad("No non-completed tasks found for handover");
      }

      const clearance = await this.prisma.clearance.findFirst({
        where: {
          offboarding: { userId: user.id },
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
        await tx.user.update({
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
                fileLink,
                fileName,
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
      throw bad(`Failed to initiate task handover: ${error instanceof Error ? error.message : String(error)}`);
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
          OR: [
            { toUserId: userId }, // handover record
            {
              task: {
                assignees: {
                  some: {
                    userId: userId
                  }
                }
              }
            }
          ]
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
          fromUser: true,
          toUser: true,
        }
      });

    } catch (error) {
      console.log(error);
      throw bad(
        `Failed to get handover details: ${error instanceof Error ? error.message : String(error)}`
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
      bad(`Failed to validate department clearance: ${error instanceof Error ? error.message : String(error)}`);
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
      bad(`Failed to upload handover signature: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async departmentClearance(userId: string, managerId: string, data: DepartmentClearanceDto) {
    try {
      const { notes, signatureId } = data;
      const isManager = this.isManagerOfUser(userId, managerId);
      if (!isManager) throw bad("User is not a department manager");

      await this.validateDepartmentClearance(userId);

      const { deptClearanceId, clearanceId } = await this.findUserDeptClearance(userId, notes); 

      //Confirm that the fromUser and toUser have already uploaded their signatures
      const signatures = await this.prisma.signatures.findMany({
        where: {
          clearanceId: clearanceId,
          role: { in: ["USER", "RECEIVER"] },
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
      bad(`Failed to complete department clearance: ${error instanceof Error ? error.message : String(error)}`);
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

  async getAllPendingClaims(userId: string) {
    const user = await this.findUserById(userId);
    try {
      const claims = await this.prisma.claim.findMany({
        where: {
          userId: user.id,
          status: "PENDING",
        },
        include: {
          finance: true
        }
      });
      return claims
    } catch (error) {
       console.log(error);
      bad(`Get all pending claims failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateAssetDebt(tx: any, userId: string, financeId: string) {
    try {
      const assessments = await this.prisma.assetAssesment.findMany({
      where: {
        assignment: { userId },
        isCleared: false,
        liabilityCost: { gt: 0 },
      },
    });
    if(!assessments.length) {
      throw bad("No valid assessments found");
    }

    //Calculate total liability
    const total = assessments.reduce(
      (sum, aa) => sum + (aa.liabilityCost || 0),
      0
    );
    if(total <= 0) return;

    //Prevent Duplicate asset debts 
    const existing = await tx.debt.findFirst({
      where: { 
        financeId,
        type: 'ASSET',
      },
    });
    if(existing) return;

    await tx.debt.create({
      data: {
        title: "Asset Liability",
        amount: total,
        remainingAmount: total,
        type: 'ASSET',
        finance: { connect: { id: financeId } },
          aa: {
          connect: assessments.map((a) => ({ id: a.id })),
        },
      },
    }); 
    } catch (error) {
      console.log(error);
      bad(`Failed to create aggregate debt: ${error instanceof Error ? error.message : String(error)}`);
    }
    
  }

  async addManualDebt(financeId: string, input: { title: string; amount: number }) {
    const { title, amount } = input;

    if (amount <= 0) throw bad("Invalid amount");

    return this.prisma.debt.create({
      data: {
        title,
        amount,
        remainingAmount: amount,
        type: "MANUAL",
        finance: { connect: { id: financeId } },
      },
    });
  }

  async initiateFinanceClearance( userId: string, data: FinanceClearanceDto) {
    try {
      const { isDebt, comment } = data;
      return await this.prisma.$transaction(async (tx) => {
        const employee = await this.findUserById(userId);

        //Find finanace clearance record linked to user's offboarding
        const clearance = await this.prisma.clearance.findFirst({
          where: {
            offboarding: { userId: employee.id },
            type: "FINANCE",
          },
          include: {
            finance: {
              include: {
                debts: true,
                claims: true,
              },
            },
          },
        });
        if(!clearance) {
          throw bad("Finance clearance not found for user's offboarding");
        }

        //Get all pending claims for the user
        const pendingClaims = await this.getAllPendingClaims(employee.id);

        let finance = clearance.finance;
        if(!finance) {
          finance = await tx.financeClearance.create({
            data: {
              employee: { connect: { id: employee.id } },
              clearance: { connect: { id: clearance.id } },
              ...(comment && {
                comment:{ create: { comment } },
              }),
              ...(pendingClaims.length > 0 && {
                claims: {
                  connect: pendingClaims.map((c) => ({ id: c.id })),
                },
              }),
            },
            include: {
              debts: true,
              claims: true,
            },
          });
        }
        //Generate asset debt if any
        await this.generateAssetDebt(tx, employee.id, finance.id);

        //Refech updated finance state
        const updatedFinance = await tx.financeClearance.findUnique({
          where: { id: finance.id },
          include: {
            debts: true,
            claims: true,
            clearance: true,
          },
        });
      });
    } catch (error) {
      console.log(error);
      bad(`Failed to initiate finance clearance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async evaluateFinanceCompletion(tx: any, finance: any) {
    const hasOutstandingDebt = finance.debts.some(
      (d: any) => (d.remainingAmount ?? d.amount) > 0,
    );

    const hasPendingClaims = finance.claims.length > 0;

    // ✅ Nothing to settle → auto-complete
    if (!hasOutstandingDebt && !hasPendingClaims) {
      await tx.clearance.update({
        where: { id: finance.clearanceId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
    }
  }

   async getFinanceClearance(userId: string, employeeId: string) {
    try {
      const user = await this.findUserById(employeeId);

      const clearance = await this.prisma.clearance.findFirst({
        where: {
          offboarding: { userId: user.id },
          type:  "FINANCE"
        },
        include: {
          finance: {
            include: {
              claims: true,
              debts: true,           
              comment: true,
            },
          },
        },
      });
      return clearance?.finance;
    } catch (error) {
      console.log(error);
      bad(`Failed to get finance clearance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
        

  ////////////////////////////// FACILITY CLEARANCE ////////////////////////////////////////
  async bulkReturnAssets(userId: string, data: BulkReturnDto){
    try {
      const { assignmentIds } = data;
      if(!assignmentIds?.length) {
        throw bad("No assets selected for return");
      }

      return await this.prisma.$transaction(async (tx) => {
        //Check if user has completed department clearance
        const deptClearance = await this.prisma.clearance.findFirst({
          where: {
            type: 'DEPARTMENT',
            offboarding: { userId },
            status: 'DM_SIGNED',
          },
        });
        if(!deptClearance) {
          throw bad("Department clearance must be completed before intiating facility clearance");
        } 

         //Find facility clearence record linked to user's offboarding
      const clearance = await this.prisma.clearance.findFirst({
        where: {
          offboarding: { userId },
          type: "FACILITIES",
        },
        include: { facility: true },
      });
      if(!clearance) {
        throw bad("Facility clearance not found for user's offboarding");
      }
       const assignments = await tx.assignment.findMany({
        where: {
          id: { in: assignmentIds },
          userId,
          status: "ASSIGNED",
          returnedAt: null,
        },
       });
        if(assignments.length !== assignmentIds.length) {
          throw bad("Some assets are invalid or already returned");
        }

        //Ensure facility clearance exists
        let facilityId = clearance.facility?.id;
        if(!facilityId) {
          const created = await tx.facilityClearance.create({
            data: {
              employee: { connect: { id: userId } },
              clearance: { connect: { id: clearance.id } },
            },
          });
          facilityId = created.id;
        }

        //Update & link assignments
        await Promise.all(assignments.map(a =>
          tx.assignment.update({
            where: { id: a.id },
            data: {
              returnedAt: new Date(),
              status: "RETURNED",
              isReturned: true,
              facility: {
                connect: { id: facilityId }
              }
            }
          })
        ))
          return {
          message: "Assets returned successfully",
          count: assignments.length,
        };
      });
    
    } catch (error) {
      console.log(error);
      bad(`Bulk return failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getReturnedAssets(userId: string) {
    try {
      //Find User Offboarding
      const offboarding = await this.prisma.offboarding.findUnique({
        where: { userId: userId },
        include: { clearance: true, user: true },
      });
      if(!offboarding) throw bad("Offboarding record not found for user");

      const assignments = await this.prisma.assignment.findMany({
        where: {
          userId: offboarding.userId,
          status: "RETURNED",
          isReturned: true,
        },
        include: { asset: true, }
      });
      return assignments;
    } catch (error) {
      console.log(error);
      bad(`Get bulk return failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getAssetAssesments(userId: string) {
    const user = await this.findUserById(userId);
    try {
      return await this.prisma.assetAssesment.findMany({
        where: {
          assignment: {
            userId: user.id,
          },
        },
        include: {
          assignment: true,
        }
      });
    } catch (error) {
      console.log(error);
      bad(`Get asset assessment failed: ${error instanceof Error ? error.message : String(error)}`);
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
      bad(`Failed to review facility clearance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // async sendLiabiltyCosts(aaId: string, userId: string) {
  //   try {
  //     const assetAssessment = await this.prisma.assetAssesment.findUnique({
  //       where: { id: aaId },
  //     });
  //     if(!assetAssessment) throw bad("Asset Assessment Not Found");
  //   } catch (error) {
  //     console.log(error);
  //     bad(`Failed to send liability costs: ${error instanceof Error ? error.message : String(error)}`);
  //   }
  // }

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
      bad(`Failed to sign clearance for user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  ///////////////////////////////////////  HELPERS /////////////////////////////////////////
  private async findUserById(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { departments: true, approver: true, offboarding: true},
      });
      return user;
    } catch (error) {
      console.log(error);
      bad(`Failed to get user: ${error instanceof Error ? error.message : String(error)}`);
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
    FINANCE: ["USER", "HR", "ADMIN"]
  };

  if (!rules[clearanceType].includes(role)) {
      throw bad(`Role ${role} not allowed for ${clearanceType}`);
    }
  }

  private async findUserDeptClearance(userId: string, notes?: string) {
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
      bad(`Failed to find user clearance: ${error instanceof Error ? error.message : String(error)}`);
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
      bad(`Failed to find clearance by ID: ${error instanceof Error ? error.message : String(error)}`);
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
