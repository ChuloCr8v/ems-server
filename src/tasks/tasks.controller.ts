// src/performance/performance.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  Patch,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { ApprovalRequestDto, CreateTaskDto, UpdateTaskDto } from './dto/tasks.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReqPayload } from 'src/auth/dto/auth.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { CreateCategoryDto } from 'src/category/category.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService,
  ) { }

  //Categories

  @Auth()
  @Get("category")
  listTaskCategories(
    @Req() req: ReqPayload
  ) {
    return this.tasksService.listTaskCategories(req.user.id);
  }

  @Auth()
  @Get(":id/category")
  getTaskCategory(
    @Param("id") id: string
  ) {
    return this.tasksService.getTaskCategory(id);
  }

  @Auth(["ADMIN", "DEPT_MANAGER", "TEAM_LEAD"])
  @Post("category")
  async createTaskCategory(
    @Body() dto: CreateCategoryDto,
    @Req() req: ReqPayload

  ) {
    return this.tasksService.createTaskCategory(req.user.id, dto);
  }

  @Auth(["ADMIN", "DEPT_MANAGER", "TEAM_LEAD"])
  @Patch(":id/category")
  async updateTaskCategory(
    @Body() dto: CreateCategoryDto,
    @Param("id") id: string

  ) {
    return this.tasksService.updateTaskCategory(id, dto);
  }

  @Auth(["ADMIN", "DEPT_MANAGER", "TEAM_LEAD"])
  @Delete(":id/category")
  async deleteTaskCategory(
    @Param("id") id: string

  ) {
    return this.tasksService.deleteTaskCategory(id);
  }

  @Auth()
  @Post()
  async createTask(
    @Body() createTaskDto: CreateTaskDto,
    @Req() req: ReqPayload

  ) {
    const createdById = req.user.id;
    return this.tasksService.createTask(createTaskDto, createdById);
  }

  @Auth()
  @Get()
  getAllTasks(
    @Req() req: ReqPayload
  ) {
    return this.tasksService.getAllTasks(req.user.id);
  }

  @Auth()
  @Get(':id')
  async getOneTask(@Param('id') id: string) {
    return this.tasksService.getOneTask(id);
  }

  @Auth()
  @Patch(':id')
  updateTask(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto, @Req() req: ReqPayload) {

    const userId = req.user.id
    return this.tasksService.updateTask(id, updateTaskDto, userId);
  }

  @Auth()
  @Delete(':id')
  async deleteTask(
    @Param('id') id: string,
    @Req() req: ReqPayload

  ) {
    const userId = req.user.id;
    const userRole = req.userRole // Replace with actual user role from auth
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

  @Auth(["DEPT_MANAGER", "ADMIN", "TEAM_LEAD"])
  @Post(':id/transfer')
  async transferTask(
    @Param('id') id: string, @Req() req: ReqPayload, @Body() dto: { ownerId: string, newDeliveryDate: Date, note?: string }) {
    return this.tasksService.transfer(id, req.user.id, dto.ownerId, dto.newDeliveryDate, dto.note);
  }


  @Auth(["DEPT_MANAGER", "ADMIN", "TEAM_LEAD"])
  @Post(':id/extend')
  async extendDueDate(
    @Param('id') id: string, @Req() req: ReqPayload, @Body() dto: { newDeliveryDate: Date, note?: string }) {
    return this.tasksService.extendDueDate(id, req.user.id, dto.newDeliveryDate, dto.note);
  }


  @Auth()
  @Post(':id/request-extension')
  async requestExtension(
    @Param('id') id: string, @Req() req: ReqPayload, @Body() dto: { newDeliveryDate: Date, note?: string }) {
    return this.tasksService.requestExtension(id, req.user.id, dto.newDeliveryDate, dto.note);
  }


  @Auth()
  @Post(':id/accept-extension')
  async acceptExtensionRequest(
    @Param('id') id: string, @Req() req: ReqPayload, @Body() dto: { newDeliveryDate: Date, note?: string }) {
    return this.tasksService.acceptExtensionRequest(id, req.user.userRole, dto.newDeliveryDate);
  }

  @Auth()
  @Patch(':id/reject-extension')
  async rejectExtensionRequest(
    @Param('id') id: string, @Req() req: ReqPayload) {
    return this.tasksService.rejectExtensionRequest(id, req.user.userRole);
  }

  @Auth()
  @Patch(':id/hide-extension')
  async hideExtension(
    @Param('id') id: string) {
    return this.tasksService.hideExtension(id);
  }

  //Task Comments

  @Auth()
  @Post(':id/comment')
  async commentOnTask(
    @Param('id') id: string,
    @Req() req: ReqPayload,
    @Body() dto: { comment: string, uploads?: string[] },
  ) {
    const userId = req.user.id
    return this.tasksService.commentOnTask(id, userId, dto);
  }

  @Auth()
  @Get(':id/comment')
  async listTaskComments(
    @Param('id') id: string,) {
    return this.tasksService.listTaskComments(id);
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