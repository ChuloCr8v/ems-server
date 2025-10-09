// src/performance/performance.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
  UseGuards,
  Req,
  DefaultValuePipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { TasksService } from './tasks.service';
import { ApprovalRequestDto, CreateTaskDto, TaskPriority, UpdateTaskDto, TaskCategory } from './dto/tasks.dto';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService,
    private readonly prisma: PrismaService,
  ) {}

  private async getFirstUser() {
    const user = await this.prisma.user.findFirst();
    if (!user) {
      throw new Error('No users found in database. Please run the seed script.');
    }
    return user;
  }

  // @Post()
  // @UseInterceptors(FilesInterceptor('files'))
  // async createTask(
  //   @Body() createTaskDto: CreateTaskDto,
  //   @UploadedFiles() files: Express.Multer.File[],
  // ) {
  //   const user = await this.getFirstUser();
  //   // In a real app, you'd get this from the auth token
  //   const createdById = user.id ; // Replace with actual user ID from auth
  //   return this.tasksService.createTask(createTaskDto, createdById, files);
  // }

  // @Get()
  // async getAllTasks(
  //   @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  //   @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  //   @Query('status') status?: string,
  //   @Query('approvalStatus') approvalStatus?: string,
  //   @Query('priority') priority?: string,
  //   @Query('category') category?: string,
  //   @Query('search') search?: string,
  // ) {

  //   const filters = {
  //     ...(status && { status: status as TaskStatus }),
  //     ...(approvalStatus && { approvalStatus: approvalStatus as any }), // Replace 'any' with ApprovalStatus if imported
  //     ...(priority && { priority: priority as TaskPriority }),
  //     ...(category && { category: category as TaskCategory }),
  //     ...(search && { search }),
  //   };

  //   return this.tasksService.getAllTasks(page, limit, undefined, undefined, filters);
  // }

  @Get()
  getAllTasks() {
    return this.tasksService.getAllTasks();
  }

  @Get(':id')
  async getOneTask(@Param('id') id: string) {
    return this.tasksService.getOneTask(id);
  }

  @Put(':id')
  updateTask(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.tasksService.updateTask(id, updateTaskDto);
  }

  // @Put(':id')
  // async updateTask(
  //   @Param('id') id: string,
  //   @Body() updateTaskDto: UpdateTaskDto,
  // ) {
  //   // In a real app, you'd get this from the auth token
  //   const userId = 'user-id-from-token'; // Replace with actual user ID from auth
  //   const userRole = 'user-role-from-token'; // Replace with actual user role from auth
  //   return this.tasksService.updateTask(id, updateTaskDto, userId, userRole);
  // }

  @Delete(':id')
  async deleteTask(@Param('id') id: string) {
    // In a real app, you'd get this from the auth token
    const userId = 'user-id-from-token'; // Replace with actual user ID from auth
    const userRole = 'user-role-from-token'; // Replace with actual user role from auth
    return this.tasksService.deleteTask(id, userId, userRole);
  }

  @Post('approval-request')
  async requestApproval(@Body() approvalRequestDto: ApprovalRequestDto) {
    // In a real app, you'd get this from the auth token
    const requestedById = 'user-id-from-token'; // Replace with actual user ID from auth
    return this.tasksService.requestApproval(
      approvalRequestDto.taskId,
      approvalRequestDto,
      requestedById,
    );
  }

  @Post(':id/approve')
  async approveTask(
    @Param('id') id: string,
    @Body() body: { assignees?: string[] },
  ) {
    // In a real app, you'd get this from the auth token
    const approvedById = 'user-id-from-token'; // Replace with actual user ID from auth
    return this.tasksService.approveTask(id, approvedById, body.assignees);
  }

  @Post(':id/reject')
  async rejectTask(
    @Param('id') id: string,
    @Body() body: { rejectionReason: string },
  ) {
    // In a real app, you'd get this from the auth token
    const rejectedById = 'user-id-from-token'; // Replace with actual user ID from auth
    return this.tasksService.rejectTask(id, rejectedById, body.rejectionReason);
  }
}