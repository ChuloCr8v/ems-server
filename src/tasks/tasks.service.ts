// tasks.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalStatus, CategoryType, Prisma, TaskStatus, User } from '@prisma/client';
import { ApprovalRequestDto, CreateTaskDto, TaskPriority, TaskResponseDto, UpdateTaskDto } from './dto/tasks.dto';
import { IdGenerator } from 'src/utils/IdGenerator.util';
import { bad, mustHave } from 'src/utils/error.utils';
import { CreateCategoryDto } from 'src/category/category.dto';


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
      const userRole = await this.getUserRole(createdById);
      const isManager = this.isManager(userRole);

      console.log(createTaskDto)

      // Validate assignees exist if provided
      if (assignees && assignees.length > 0) {
        const existingUsers = await this.prisma.user.findMany({
          where: { id: { in: assignees } },
          select: { id: true },
        });

        if (existingUsers.length !== assignees.length) {
          throw new BadRequestException('One or more assignees not found');
        }
      }

      // FIX: Only include dates if they are valid ISO strings
      const createData: any = {
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        status: isManager ? 'IN_PROGRESS' : 'PENDING_APPROVAL',
        approvalStatus: isManager ? 'APPROVED' : 'PENDING',
        createdById,
      };

      // Only add startDate if it's a valid ISO string
      if (typeof taskData.startDate === 'string' && this.isValidISODate(taskData.startDate)) {
        createData.startDate = new Date(taskData.startDate);
      }

      // Only add dueDate if it's a valid ISO string
      if (typeof taskData.dueDate === 'string' && this.isValidISODate(taskData.dueDate)) {
        createData.dueDate = new Date(taskData.dueDate);
      }

      // Add approval data for managers
      if (isManager && assignees && assignees.length > 0) {
        createData.approvedById = createdById;
        createData.approvedAt = new Date();
        createData.approvalRequestedAt = new Date();
      } else if (!isManager) {
        createData.approvalRequestedAt = new Date();
      }

      // Add assignees if provided
      if (assignees && assignees.length > 0) {
        createData.assignees = {
          create: assignees.map(userId => ({ userId })),
        };
      }

      console.log('🔍 Creating task with data:', createData);
      const task = await this.prisma.task.create({
        data: {
          ...createData,
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

  async getAllTasks() {
    const tasks = await this.prisma.task.findMany({
      include: this.getTaskInclude(),
      orderBy: {
        createdAt: 'desc'
      },
    });

    return tasks
  }

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

  async updateTask(id: string, taskData: UpdateTaskDto) {
    const { assignees, category, uploads, ...rest } = taskData;

    await this.getOneTask(id);

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

  async deleteTask(id: string, userId: string, userRole: string[]) {
    const task = await this.getOneTask(id);

    console.log(task, userId)

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

  getTaskInclude() {
    return {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
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
          user: true
        }
      },
      category: true,
      uploads: true,
    };
  }
}