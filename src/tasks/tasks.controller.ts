// src/performance/performance.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { TasksService } from './tasks.service';
import { ApprovalRequestDto, CreateTaskDto, UpdateTaskDto } from './dto/tasks.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService,
    private readonly prisma: PrismaService,
  ) { }

  private async getFirstUser() {
    const user = await this.prisma.user.findFirst();
    if (!user) {
      throw new Error('No users found in database. Please run the seed script.');
    }
    return user;
  }

  @Post()
  async createTask(
    @Body() createTaskDto: CreateTaskDto,
  ) {
    const user = await this.getFirstUser();
    const createdById = user.id;
    return this.tasksService.createTask(createTaskDto, createdById);
  }

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