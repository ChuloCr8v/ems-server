// tasks.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalStatus, Prisma, TaskStatus } from '@prisma/client';
import { ApprovalRequestDto, CreateTaskDto, TaskCategory, TaskPriority, TaskQueryDto, TaskResponseDto, UpdateTaskDto } from './dto/tasks.dto';


// Define Prisma types for better type safety
type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    createdBy: { select: { id: true; firstName: true; lastName: true; email: true; role: true } };
    approvedBy: { select: { id: true; firstName: true; lastName: true; email: true } };
    assignees: { include: { user: { select: { id: true; firstName: true; lastName: true; email: true } } } };
    uploads: true;
  };
}>;

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  private async getUserRole(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    return user?.role || 'EMPLOYEE';
  }

  private isManager(role: string): boolean {
    return role === 'MANAGER' || role === 'ADMIN';
  }

  private mapToTaskResponseDto(task: TaskWithRelations): TaskResponseDto {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      startDate: task.startDate,
      dueDate: task.dueDate,
      category: task.category as TaskCategory,
      priority: task.priority as TaskPriority,
      status: task.status as TaskStatus,
      approvalStatus: task.approvalStatus as ApprovalStatus,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      approvalRequestedAt: task.approvalRequestedAt,
      approvedAt: task.approvedAt,
      rejectionReason: task.rejectionReason,
      createdBy: {
        id: task.createdBy.id,
        name: `${task.createdBy.firstName} ${task.createdBy.lastName}`,
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

  // async createTask(createTaskDto: CreateTaskDto, createdById: string, files?: Express.Multer.File[]) {
  //   const { assignees, ...taskData } = createTaskDto;
  //   const userRole = await this.getUserRole(createdById);
  //   const isManager = this.isManager(userRole);

  //      // Validate assignees exist if provided
  //   if (assignees && assignees.length > 0) {
  //     const existingUsers = await this.prisma.user.findMany({
  //       where: { id: { in: assignees } },
  //       select: { id: true },
  //     });
      
  //     if (existingUsers.length !== assignees.length) {
  //       throw new BadRequestException('One or more assignees not found');
  //     }
  //   }

  //     // Convert date strings to Date objects with proper time
  //   const startDate = taskData.startDate ? new Date(taskData.startDate + 'T00:00:00.000Z') : null;
  //   const dueDate = taskData.dueDate ? new Date(taskData.dueDate + 'T23:59:59.999Z') : null;


  //   // Determine approval status based on user role
  //   const approvalStatus = isManager ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING;
  //   const status = isManager ? TaskStatus.IN_PROGRESS : TaskStatus.PENDING_APPROVAL;
    
  //   // Managers can assign directly, employees cannot
  //   const assigneesData = isManager && assignees && assignees.length > 0 ? {
  //     create: assignees.map(userId => ({ userId })),
  //   } : undefined;

  //   const task = await this.prisma.task.create({
  //     data: {
  //       ...taskData,
  //       status,
  //       startDate,
  //       dueDate,
  //       approvalStatus,
  //       createdById,
  //       // If manager creates and assigns, they auto-approve
  //       ...(isManager && assignees && assignees.length > 0 && {
  //         approvedById: createdById,
  //         approvedAt: new Date(),
  //         approvalRequestedAt: new Date(),
  //       }),
  //       // Only set approval requested date for employees
  //       ...(!isManager && {
  //         approvalRequestedAt: new Date(),
  //       }),
  //       assignees: assigneesData,
  //     },
  //     include: this.getTaskInclude(),
  //   });

  //   // Handle file uploads
  //   if (files && files.length > 0) {
  //     await this.prisma.upload.createMany({
  //       data: files.map(file => ({
  //         name: file.originalname,
  //         size: file.size,
  //         type: file.mimetype,
  //         key: file.filename,
  //         uri: file.path,
  //         taskId: task.id,
  //       })),
  //     });
  //   }

  //   // Reload with all relations
  //   const taskWithRelations = await this.prisma.task.findUnique({
  //     where: { id: task.id },
  //     include: this.getTaskInclude(),
  //   });

  //   return this.mapToTaskResponseDto(taskWithRelations!);
  // }

  // src/tasks/tasks.service.ts
async createTask(createTaskDto: CreateTaskDto, createdById: string, files?: Express.Multer.File[]) {
  try {
    const { assignees, ...taskData } = createTaskDto;
    const userRole = await this.getUserRole(createdById);
    const isManager = this.isManager(userRole);

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
      category: taskData.category,
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
      data: createData,
      include: this.getTaskInclude(),
    });

    // Handle file uploads
    if (files && files.length > 0) {
      console.log('Files to upload:', files);
    }

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
      include: this.getTaskInclude(),
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
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        status: TaskStatus.IN_PROGRESS,
        approvedById,
        approvedAt: new Date(),
        // Clear any existing assignees and set new ones
        ...(assignees && assignees.length > 0 && {
          assignees: {
            deleteMany: {},
            create: assignees.map(userId => ({ userId })),
          },
        }),
      },
      include: this.getTaskInclude(),
    });

    return this.mapToTaskResponseDto(updatedTask);
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
      include: this.getTaskInclude(),
    });

    return this.mapToTaskResponseDto(updatedTask);
  }

  // async getAllTasks(
  //   page: number = 1, 
  //   limit: number = 50, 
  //   userId?: string, 
  //   userRole?: string,
  //   filters?: TaskQueryDto
  // ) {
  //   const skip = (page - 1) * limit;
    
  //   // Build where clause based on user role and filters
  //   let where: any = {};
    
  //   // Role-based filtering
  //   if (userId && userRole && !this.isManager(userRole)) {
  //     where.OR = [
  //       { createdById: userId },
  //       { assignees: { some: { userId } } },
  //     ];
  //   }

  //   // Apply filters
  //   if (filters) {
  //     if (filters.status) where.status = filters.status;
  //     if (filters.approvalStatus) where.approvalStatus = filters.approvalStatus;
  //     if (filters.priority) where.priority = filters.priority;
  //     if (filters.category) where.category = filters.category;
      
  //     // Date range filters
  //     if (filters.startDateFrom || filters.startDateTo) {
  //       where.startDate = {};
  //       if (filters.startDateFrom) where.startDate.gte = filters.startDateFrom;
  //       if (filters.startDateTo) where.startDate.lte = filters.startDateTo;
  //     }
      
  //     if (filters.dueDateFrom || filters.dueDateTo) {
  //       where.dueDate = {};
  //       if (filters.dueDateFrom) where.dueDate.gte = filters.dueDateFrom;
  //       if (filters.dueDateTo) where.dueDate.lte = filters.dueDateTo;
  //     }
      
  //     // Search filter
  //     if (filters.search) {
  //       where.OR = [
  //         ...(where.OR || []),
  //         { title: { contains: filters.search, mode: 'insensitive' } },
  //         { description: { contains: filters.search, mode: 'insensitive' } },
  //       ];
  //     }
  //   }

  //   const [tasks, total] = await Promise.all([
  //     this.prisma.task.findMany({
  //       where,
  //       skip,
  //       take: limit,
  //       include: this.getTaskInclude(),
  //       orderBy: { 
  //         [filters?.sortBy || 'createdAt']: filters?.sortOrder || 'desc' 
  //       },
  //     }),
  //     this.prisma.task.count({ where }),
  //   ]);

  //   return {
  //     tasks: tasks.map(task => this.mapToTaskResponseDto(task)),
  //     pagination: {
  //       page,
  //       limit,
  //       total,
  //       pages: Math.ceil(total / limit),
  //     },
  //   };
  // }


  // async getOneTask(id: string, userId?: string, userRole?: string) {
  //   const task = await this.prisma.task.findUnique({
  //     where: { id },
  //     include: this.getTaskInclude(),
  //   });

  //   if (!task) {
  //     throw new NotFoundException(`Task with ID ${id} not found`);
  //   }

  //   // Authorization check
  //   if (userId && userRole && !this.isManager(userRole)) {
  //     const isCreator = task.createdById === userId;
  //     const isAssignee = task.assignees.some(assignee => assignee.userId === userId);
      
  //     if (!isCreator && !isAssignee) {
  //       throw new ForbiddenException('You do not have permission to view this task');
  //     }
  //   }

  //   return this.mapToTaskResponseDto(task);
  // }

  // async updateTask(id: string, updateTaskDto: UpdateTaskDto, userId: string, userRole: string) {
  //   const { assignees, ...taskData } = updateTaskDto;

  //   const existingTask = await this.getOneTask(id, userId, userRole);

  //   // Authorization: Only creators or managers can update tasks
  //   const isCreator = existingTask.createdBy.id === userId;
  //   if (!isCreator && !this.isManager(userRole)) {
  //     throw new ForbiddenException('You can only update your own tasks');
  //   }

  //   // Managers can update anything, creators can only update certain fields
  //   const allowedUpdates = this.isManager(userRole) ? 
  //     { ...taskData } : 
  //     { 
  //       title: taskData.title,
  //       description: taskData.description,
  //       startDate: taskData.startDate,
  //       dueDate: taskData.dueDate,
  //       category: taskData.category,
  //       priority: taskData.priority,
  //     };

  //   const task = await this.prisma.task.update({
  //     where: { id },
  //     data: {
  //       ...allowedUpdates,
  //       // Only managers can update assignees directly
  //       ...(this.isManager(userRole) && assignees && {
  //         assignees: {
  //           deleteMany: {},
  //           create: assignees.map(userId => ({ userId })),
  //         },
  //       }),
  //     },
  //     include: this.getTaskInclude(),
  //   });

  //   return this.mapToTaskResponseDto(task);
  // }

    async getAllTasks() {
    const tasks = await this.prisma.task.findMany({
      include: this.getTaskInclude(),
      orderBy: { 
        createdAt: 'desc' 
      },
    });

    return tasks.map(task => this.mapToTaskResponseDto(task));
  }

  async getOneTask(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: this.getTaskInclude(),
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return this.mapToTaskResponseDto(task);
  }

  async updateTask(id: string, updateTaskDto: UpdateTaskDto) {
    const { assignees, ...taskData } = updateTaskDto;

    // Check if task exists
    await this.getOneTask(id);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...taskData,
        ...(assignees !== undefined && {
          assignees: {
            deleteMany: {},
            create: assignees.map(userId => ({ userId })),
          },
        }),
      },
      include: this.getTaskInclude(),
    });

    return this.mapToTaskResponseDto(task);
  }

  async deleteTask(id: string, userId: string, userRole: string) {
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

  private getTaskInclude() {
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
      uploads: true,
    };
  }
}