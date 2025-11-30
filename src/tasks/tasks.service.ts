// tasks.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalStatus, CategoryType, Prisma, Role, Task, TaskStatus, User } from '@prisma/client';
import { ApprovalRequestDto, CreateTaskDto, TaskPriority, TaskResponseDto, UpdateTaskDto } from './dto/tasks.dto';
import { IdGenerator } from 'src/utils/IdGenerator.util';
import { bad, mustHave } from 'src/utils/error.utils';
import { CreateCategoryDto } from 'src/category/category.dto';
import { create } from 'domain';


@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) { }

  private async getUserRole(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userRole: true }
    });
    return user?.userRole
  }

  private isManager(role: string[]): boolean {
    const managerRoles = ["ADMIN", "DEPT_MANAGER"]
    return role?.some(r => managerRoles.includes(r))
  }

  private mapToTaskResponseDto(task): TaskResponseDto {
    return {
      id: task.id,
      taskId: task.taskId,
      title: task.title,
      description: task.description,
      startDate: task.startDate,
      dueDate: task.dueDate,
      // category: task.category,
      priority: task.priority as TaskPriority,
      status: task.status as TaskStatus,
      approvalStatus: task.approvalStatus as ApprovalStatus,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      approvalRequestedAt: task.approvalRequestedAt,
      approvedAt: task.approvedAt,
      rejectionReason: task.rejectionReason,
      createdBy: {
        id: task.createdById,
        name: `${task.createdBy} ${task.createdBy.lastName}`,
        email: task.createdBy.email,
        role: task.createdBy.role,
      },
      approvedBy: task.approvedBy ? {
        id: task.approvedBy.id,
        name: `${task.approvedBy.firstName} ${task.approvedBy.lastName}`,
        email: task.approvedBy.email,
      } : undefined,
      assignees: task.assignees.map(at => ({
        id: at.user.id,
        name: `${at.user.firstName} ${at.user.lastName}`,
        email: at.user.email,
        assignedAt: at.assignedAt,
      })),
      files: task.uploads.map(upload => ({
        id: upload.id,
        filename: upload.key || '',
        originalName: upload.name,
        mimetype: upload.type,
        size: upload.size,
        uploadedAt: upload.createdAt,
        uri: upload.uri || undefined,
      })),
    };
  }

  async createTask(createTaskDto: CreateTaskDto, createdById: string) {
    try {
      const { uploads, assignees, category, ...taskData } = createTaskDto;

      const taskCreator = await this.prisma.user.findUnique({
        where: {
          id: createdById
        }, include: {
          departments: true
        }
      })

      if (!taskCreator) mustHave(taskCreator, "Unathorized", 401)

      const userRole = await this.getUserRole(createdById);
      const isManager = this.isManager(userRole);




      if (isManager) {
        if (!assignees)
          return bad("Please provide at least one assignee");

        const { startDate, dueDate } = createTaskDto;

        if (!startDate)
          return bad("Please provide a start date");

        if (!dueDate)
          return bad("Please provide a due date");
      }

      if (assignees && assignees.length > 0) {
        const existingUsers = await this.prisma.user.findMany({
          where: { id: { in: assignees } },
          select: { id: true },
        });

        if (existingUsers.length !== assignees.length) {
          throw new BadRequestException('One or more assignees not found');
        }
      }

      const createData: any = {
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        status: isManager ? 'IN_PROGRESS' : 'PENDING_APPROVAL',
        approvalStatus: isManager ? 'APPROVED' : 'PENDING',
        createdById,
      };

      if (typeof taskData.startDate === 'string' && this.isValidISODate(taskData.startDate)) {
        createData.startDate = new Date(taskData.startDate);
      }

      if (typeof taskData.dueDate === 'string' && this.isValidISODate(taskData.dueDate)) {
        createData.dueDate = new Date(taskData.dueDate);
      }

      if (isManager && assignees && assignees.length > 0) {
        createData.approvedById = createdById;
        createData.approvedAt = new Date();
        createData.approvalRequestedAt = new Date();
      } else if (!isManager) {
        createData.approvalRequestedAt = new Date();
      }

      if (assignees && assignees.length > 0) {
        createData.assignees = {
          create: assignees.map(userId => ({ userId })),
        };
      }

      const taskDepts = createTaskDto.department ?? (await this.prisma.user.findUnique({
        where: { id: createdById },
        include:
        {
          departments: true
        }
      }))?.departments[0].id

      console.log(taskDepts)

      //Add creator as assignee if not manager
      createData.assignees = {
        create: { userId: createdById },
      }

      const task = await this.prisma.task.create({
        data: {
          ...createData,
          departmentId: taskDepts,
          taskId: IdGenerator("TSK"),
          ...(uploads && uploads.length > 0
            ? {
              uploads: {
                connect: uploads.map((id) => ({ id })),
              },
            }
            : {}),
          ...(category && category.length > 0
            ? {
              category: {
                connect: category.map((id) => ({ id })),
              },
            }
            : {}),
        },
        // include: this.getTaskInclude(),
      });

      return task;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error creating task:', error);
      throw new InternalServerErrorException('Error creating task');
    }
  }

  // Helper method to validate ISO date strings
  private isValidISODate(dateString: string): boolean {
    if (!dateString) return false;

    // Check if it's a valid ISO string
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
    if (!isoRegex.test(dateString)) return false;

    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  async requestApproval(taskId: string, approvalRequestDto: ApprovalRequestDto, requestedById: string) {
    const { assignees } = approvalRequestDto;
    const userRole = await this.getUserRole(requestedById);

    if (this.isManager(userRole)) {
      throw new BadRequestException('Managers do not need to request approval');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { createdBy: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.createdById !== requestedById) {
      throw new ForbiddenException('You can only request approval for your own tasks');
    }

    if (task.approvalStatus !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Approval has already been requested or processed');
    }

    // Update task with approval request
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        approvalStatus: ApprovalStatus.PENDING,
        status: TaskStatus.PENDING_APPROVAL,
        approvalRequestedAt: new Date(),
      },
      // include: this.getTaskInclude(),
    });

    return this.mapToTaskResponseDto(updatedTask);
  }

  async approveTask(taskId: string, approvedById: string, assignees?: string[]) {
    const userRole = await this.getUserRole(approvedById);

    if (!this.isManager(userRole)) {
      throw new ForbiddenException('Only managers can approve tasks');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.approvalStatus !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Task is not pending approval');
    }

    // Update task with approval and assignees
    // const updatedTask = await this.prisma.task.update({
    //   where: { id: taskId },
    //   data: {
    //     approvalStatus: ApprovalStatus.APPROVED,
    //     status: TaskStatus.IN_PROGRESS,
    //     approvedById,
    //     approvedAt: new Date(),
    //     // Clear any existing assignees and set new ones
    //     ...(assignees && assignees.length > 0 && {
    //       assignees: {
    //         deleteMany: {},
    //         create: assignees.map(userId => ({ userId })),
    //       },
    //     }),
    //   },
    //   // include: this.getTaskInclude(),
    // });

    // return this.mapToTaskResponseDto(updatedTask);
  }

  //Comments

  async commentOnTask(id: string, userId: string, dto: { comment: string, uploads?: string[] }) {
    try {
      const task = await this.prisma.task.findUnique({
        where: {
          id
        }
      })

      if (!task) mustHave(task, "Task not found", 404)
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId
        }
      })

      if (!user) mustHave(user, "user not found", 404)

      const comment = await this.prisma.comment.create({
        data: {
          comment: dto.comment,
          ...(dto.uploads ? { uploads: { connect: dto.uploads.map(u => ({ id: u })) } } : {}),
          task: { connect: { id } },
          user: { connect: { id: userId } }
        }
      })
      return {
        message: "Comment added successfully",
        data: comment
      }
    } catch (error) {
      bad(error)
    }
  }

  async listTaskComments(id: string) {
    try {
      const task = await this.getOneTask(id)
      if (!task) mustHave(task, "task not found", 404)

      return task.comments
    } catch (error) {
      bad(error)
    }
  }

  async rejectTask(taskId: string, rejectedById: string, rejectionReason: string) {
    const userRole = await this.getUserRole(rejectedById);

    if (!this.isManager(userRole)) {
      throw new ForbiddenException('Only managers can reject tasks');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.approvalStatus !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Task is not pending approval');
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        status: TaskStatus.CANCELLED,
        rejectionReason,
        approvedById: rejectedById,
        approvedAt: new Date(),
      },
      // include: this.getTaskInclude(),
    });

    return this.mapToTaskResponseDto(updatedTask);
  }

  async getAllTasks(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { departments: true },
      });

      if (!user) throw new UnauthorizedException();

      const baseFindArgs: Prisma.TaskFindManyArgs = {
        include: this.getTaskInclude(),
        orderBy: { createdAt: 'desc' },
      };

      if (user.userRole.includes(Role.ADMIN)) {
        return this.prisma.task.findMany(baseFindArgs);
      }

      if (user.userRole.includes(Role.DEPT_MANAGER) || user.userRole.includes(Role.TEAM_LEAD)) {
        const userDeptIds = user.departments.map((d) => d.id);

        return this.prisma.task.findMany({
          ...baseFindArgs,
          where: {
            OR: [
              {
                department: {
                  id: { in: userDeptIds }
                }
              },

              {
                assignees: {
                  some: { userId },
                },
              },
              {
                createdById: userId,
              },
              {
                taskTransfers: {
                  some: { userId },
                },
              },
            ],
          },
        });
      }

      return this.prisma.task.findMany({
        ...baseFindArgs,
        where: {
          OR: [
            {
              assignees: {
                some: { userId },
              },
            },
            {
              createdById: userId,
            },
            {
              taskTransfers: {
                some: { userId },
              },
            },
          ],
        },
      });
    } catch (error) {
      bad(error);
    }
  }


  //TASK EXTENSIONS
  async extendDueDate(id: string, userId: string, dueDate: Date, note?: string) {
    try {

      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
          OR: [
            {
              userRole: {
                hasSome: [Role.ADMIN, Role.DEPT_MANAGER, Role.TEAM_LEAD]
              }
            },
          ]
        },
      })

      if (!user) mustHave(user, "Unathorized", 401)


      const task = await this.prisma.task.findUnique({
        where: {
          id
        }
      })

      if (!task) mustHave(task, "Task not found", 404)

      await this.prisma.taskDueDate.create({
        data: {
          dueDate,
          task: { connect: { id } },
          note: note ?? undefined
        }
      })
    } catch (error) {
      bad(error)
    }
  }

  async requestExtension(id: string, userId: string, dueDate: Date, note?: string) {
    try {


      console.log({ dueDate })


      const task = await this.prisma.task.findUnique({
        where: {
          id
        },
        include: {
          taskTransfers: {
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      })

      if (!task) mustHave(task, "Task not found", 404)

      const taskOwner = () => {
        if (task.hasTransfer) {
          return task.taskTransfers[0].userId
        } else {
          return task.createdById
        }
      }

      if (taskOwner() !== userId) bad("You can only request extensions on your task")

      await this.prisma.extensionRequests.create({
        data: {
          dueDate: dueDate,
          task: { connect: { id } },
          note: note ?? undefined,
          requester: { connect: { id: userId } }
        }
      })
    } catch (error) {
      bad(error)
    }
  }

  async acceptExtensionRequest(id: string, userRole: Role[], dueDate?: Date,) {
    try {
      console.log(userRole)
      const canAccept = (userRole.includes(Role.DEPT_MANAGER) || userRole.includes(Role.TEAM_LEAD))

      if (!canAccept) bad("You are not authorized to accept this request")

      const extentionRequest = await this.prisma.extensionRequests.findUnique({
        where: {
          id
        },
      })

      if (!extentionRequest) mustHave(extentionRequest, "Request not found", 404)

      await this.prisma.extensionRequests.update({
        where: { id },
        data: {
          status: "APPROVED"
        }
      })

      if (dueDate) {
        await this.prisma.taskDueDate.create({
          data: {
            dueDate: dueDate,
            task: {
              connect: { id: extentionRequest.taskId }
            }
          }
        })
      }
    } catch (error) {
      bad(error)
    }
  }

  async rejectExtensionRequest(id: string, userRole: Role[]) {
    try {

      const canReject = (userRole.includes(Role.DEPT_MANAGER) || userRole.includes(Role.TEAM_LEAD))

      if (!canReject) bad("You are not authorized to reject this request")

      const extentionRequest = await this.prisma.extensionRequests.findUnique({
        where: {
          id
        },
      })

      if (!extentionRequest) mustHave(extentionRequest, "Request not found", 404)

      await this.prisma.extensionRequests.update({
        where: { id },
        data: {
          status: "REJECTED"
        }
      })
    } catch (error) {
      bad(error)
    }
  }

  async hideExtension(id: string) {
    try {
      const extentionRequest = await this.prisma.extensionRequests.findUnique({
        where: {
          id
        },

      })

      if (!extentionRequest) mustHave(extentionRequest, "Request not found", 404)

      await this.prisma.extensionRequests.update({
        where: { id },
        data: {
          isVisible: false
        }
      })
    } catch (error) {
      bad(error)
    }
  }


  //TASK CATEGORIES

  async createTaskCategory(userId: string, dto: CreateCategoryDto) {
    const { title, department, description, color } = dto

    try {
      const createdBy = await this.prisma.user.findUnique({
        where: {
          id: userId
        },
      })

      if (!createdBy) mustHave(createdBy, "User not found", 404)

      const categoryExists = await this.prisma.category.findUnique({
        where: {
          title
        }
      })

      if (categoryExists) bad(`${title} already created`)
      if (department) {
        const deptExists = await this.prisma.department.findMany({ where: { id: { in: department } } })

        if (deptExists.length < department.length) bad("One or more departments not found")
      }

      const res = await this.prisma.category.create({
        data: {
          categoryId: IdGenerator("CAT"),
          title,
          type: CategoryType.Task,
          description: description || undefined,
          color: color || "gray",
          departments: { connect: department.map((id) => ({ id })) },
          createdBy: { connect: { id: userId } },
        },
      })

      return {
        message: title + " " + "created successfully",
        data: res
      }
    } catch (error) {
      bad(error)
    }
  }

  async updateTaskCategory(id: string, dto: CreateCategoryDto) {
    const { title, department, description, color } = dto;

    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
        include: { departments: true },
      });

      if (!category) bad("Category not found");

      if (department && department.length > 0) {
        const deptExists = await this.prisma.department.findMany({
          where: { id: { in: department } },
        });

        if (deptExists.length < department.length) {
          bad("One or more departments not found");
        }
      }

      const res = await this.prisma.category.update({
        where: { id },
        data: {
          title: title || undefined,
          description: description || undefined,
          color: color || undefined,

          departments: {
            set: department
              ? department.map((id) => ({ id }))
              : undefined,
          },
        },
      });

      return {
        message: `${title} updated successfully`,
        data: res,
      };
    } catch (error) {
      bad(error);
    }
  }

  async deleteTaskCategory(id: string) {

    try {
      await this.prisma.category.delete({
        where: {
          id
        }
      })

      return {
        message: `category deleted successfully`,
      };
    } catch (error) {
      bad(error);
    }
  }

  async listTaskCategories(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { departments: true },
      });

      if (!user) bad("User not found");

      const departmentIds = user.departments.map((d) => d.id);

      const categories = await this.prisma.category.findMany({
        where: {
          type: CategoryType.Task,
          departments: {
            some: {
              id: { in: departmentIds }
            }
          },
        },
        orderBy: { title: "asc" },
        include: {
          tasks: {
            include: this.getTaskInclude(),
          },
        },
      });

      return categories;
    } catch (error) {
      bad(error);
    }
  }

  async getOneTask(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: this.getTaskInclude(),
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task
  }

  async getTaskCategory(id: string) {
    try {
      const taskCategory = await this.prisma.category.findUnique({
        where: { id },
        include: { departments: true }
      });

      if (!taskCategory) {
        bad(`Task with ID ${id} not found`);
      }
      return taskCategory
    } catch (error) {
      bad(error)
    }

  }

  async updateTask(id: string, taskData: UpdateTaskDto, userId: string) {

    const { assignees, category, uploads, status, issue, ...rest } = taskData;
    const findTask = await this.getOneTask(id);
    if (!findTask) mustHave(findTask, "Task not found", 404)

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      }
    })

    if (!user) mustHave(user, "User not found", 404)

    const canAct = user.userRole.includes("ADMIN") || user.userRole.includes("DEPT_MANAGER") || user.userRole.includes("TEAM_LEAD")

    const ownerId = await this.taskOwner(findTask.id)

    if (!canAct && ownerId !== userId) bad("You are not authorized to perform this action")

    if (status && (["IN_PROGRESS", "APPROVED"].includes(status))) {
      if (findTask.assignees.length === 0) bad("Cannot approve task without assignees")
      if (!findTask.startDate) bad("Cannot approve task without start date")
      if (!findTask.hasTransfer && !findTask.taskDueDates.length && !findTask.dueDate) bad("Cannot approve task without due date")
      if (findTask.approvalStatus === "APPROVED") bad("Task already approved")
    }

    const task = await this.prisma.$transaction(async (tx) => {

      // --- handle Uploads ---
      if (uploads !== undefined && uploads.length > 0) {
        await tx.task.update({
          where: { id },
          data: {
            uploads: {
              // set: [], // optional: clears old uploads if needed
              connect: uploads.map((u: string) => ({ id: u })),
            },
          },
        });
      }

      // --- Sync Assignees ---
      if (assignees !== undefined) {
        const existingAssignees = await tx.userTask.findMany({
          where: { taskId: id },
          select: { userId: true },
        });
        const existingIds = existingAssignees.map((a) => a.userId);

        const newIds = assignees.filter((id: string) => !existingIds.includes(id));
        const removedIds = existingIds.filter((id) => !assignees.includes(id));

        // Add new ones
        if (newIds.length > 0) {
          await tx.userTask.createMany({
            data: newIds.map((userId: string) => ({
              taskId: id,
              userId,
            })),
          });
        }

        // Remove unselected ones
        if (removedIds.length > 0) {
          await tx.userTask.deleteMany({
            where: { taskId: id, userId: { in: removedIds } },
          });
        }
      }

      // --- Handle Categories ---
      if (category !== undefined && category.length > 0) {
        await tx.task.update({
          where: { id },
          data: {
            category: {
              connect: category.map(id => ({ id }))
            }
          },
        });
      }

      // --- Handle Task Status
      const completedStatus = () => {
        if (status === "COMPLETED") {
          if (!canAct) { return TaskStatus.PENDING_REVIEW } else return TaskStatus.COMPLETED
        } else return status
      }

      await tx.task.update({
        where: {
          id
        },
        data: status === "ISSUES" ? {
          hasIssues: true,
          status,
          taskIssues: {
            create: {
              issue: issue,
              reportedBy: {
                connect: { id: userId }
              }
            }
          }
        } : {
          status: completedStatus()
        }
      })


      // --- Update Task Base Data ---
      const updatedTask = await tx.task.update({
        where: { id },
        data: rest,
        include: this.getTaskInclude(),
      });

      return updatedTask;
    });

    return task;
  }

  async transfer(
    id: string,
    userId: string,
    ownerId: string,
    newDeliveryDate?: Date,
    note?: string
  ) {
    try {
      const findTask = await this.prisma.task.findUnique({
        where: { id },
        include: {
          assignees: true,
          createdBy: {
            include: { departments: true },
          },
        },
      });

      mustHave(findTask, "Task not found", 404);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { departments: true },
      });

      mustHave(user, "User not found", 404);

      const userDepts = user.departments.map((d) => d.id);
      const taskCreatorDepts = findTask.createdBy.departments.map((d) => d.id);

      const canTransfer = () => {
        if (user.userRole.includes(Role.ADMIN)) return true;

        const isDeptManagerOrLead =
          user.userRole.includes(Role.DEPT_MANAGER) ||
          user.userRole.includes(Role.TEAM_LEAD);

        const sameDept = taskCreatorDepts.some((d) => userDepts.includes(d));

        return isDeptManagerOrLead && sameDept;
      };

      if (!canTransfer()) {
        throw new UnauthorizedException("You cannot transfer this task");
      }

      await this.prisma.taskTransfer.create({
        data: {
          user: { connect: { id: ownerId } },
          task: { connect: { id } },
          note: note ?? undefined,
        },
      });

      await this.prisma.task.update({
        where: { id },
        data: {
          hasTransfer: true,
        },
      });

      const alreadyAssigned = findTask.assignees.some(
        (a) => a.userId === ownerId
      );

      if (!alreadyAssigned) {
        await this.prisma.userTask.create({
          data: {
            user: { connect: { id: ownerId } },
            task: { connect: { id } },
          },
        });
      }

      if (newDeliveryDate) {
        await this.prisma.taskDueDate.create({
          data: {
            dueDate: newDeliveryDate,
            task: { connect: { id } },
            note: note ?? undefined,
          },
        });
      }

      return await this.prisma.task.findUnique({
        where: { id },
        include: {
          assignees: true,
        },
      });
    } catch (error) {
      bad(error?.message ?? "Failed to transfer task");
    }
  }

  async deleteTask(id: string, userId: string, userRole: string[]) {
    const task = await this.getOneTask(id);
    // Only creators or managers can delete tasks
    const isCreator = task.createdBy.id === userId;
    if (!isCreator && !this.isManager(userRole)) {
      throw new ForbiddenException('You can only delete your own tasks');
    }

    await this.prisma.task.delete({
      where: { id },
    });

    return { message: 'Task deleted successfully' };
  }

  async taskOwner(taskId: string) {
    const task = await this.getOneTask(taskId);

    if (task.hasTransfer) {

      return task.taskTransfers[0].userId
    } else {
      return task.createdById
    }
  }


  getTaskInclude() {
    return {
      department: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          departments: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      assignees: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      comments: {
        include: {
          uploads: true,
          user: true,
        },
      },
      category: true,
      uploads: true,
      taskTransfers: {
        include: {
          user: true,
        },
        orderBy: {
          createdAt: 'desc' as any,
        },
      },
      taskDueDates: {
        orderBy: {
          createdAt: 'desc' as any,
        },
      },
      extensionRequests: {
        include: { requester: true },
        orderBy: {
          createdAt: 'desc' as any,
        },
      }

    };
  }
}