// src/performance/performance.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, TaskResponseDto, UpdateTaskDto } from './dto/tasks.dto';


@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  private mapToTaskResponseDto(task: any): TaskResponseDto {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      startDate: task.startDate,
      dueDate: task.dueDate,
      category: task.category,
      priority: task.priority,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      createdBy: {
        id: task.createdBy.id,
        name: task.createdBy.name,
        email: task.createdBy.email,
      },
      assignees: task.assignees.map(at => ({
        id: at.user.id,
        name: at.user.name,
        email: at.user.email,
        assignedAt: at.assignedAt,
      })),
      files: task.files.map(file => ({
        id: file.id,
        filename: file.filename,
        originalName: file.originalName,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: file.uploadedAt,
      })),
    };
  }

  async createTask(createTaskDto: CreateTaskDto, createdById: string, files?: Express.Multer.File[]) {
    const { assignees, ...taskData } = createTaskDto;

    const task = await this.prisma.task.create({
      data: {
        ...taskData,
        createdById,
        assignees: assignees && assignees.length > 0 ? {
          create: assignees.map(userId => ({ userId })),
        } : undefined,
        files: files && files.length > 0 ? {
          create: files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            mimetype: file.mimetype,
            size: file.size,
          })),
        } : undefined,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        files: true,
      },
    });

    return this.mapToTaskResponseDto(task);
  }

  async getAllTasks(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        skip,
        take: limit,
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          assignees: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
          files: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count(),
    ]);

    return {
      tasks: tasks.map(task => this.mapToTaskResponseDto(task)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getOneTask(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        files: true,
      },
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
        ...(assignees && {
          assignees: {
            deleteMany: {}, // Remove all existing assignees
            create: assignees.map(userId => ({ userId })),
          },
        }),
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        files: true,
      },
    });

    return this.mapToTaskResponseDto(task);
  }

  async deleteTask(id: string) {
    await this.getOneTask(id); // Check if task exists
    
    await this.prisma.task.delete({
      where: { id },
    });

    return { message: 'Task deleted successfully' };
  }
}