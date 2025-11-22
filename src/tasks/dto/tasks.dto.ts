// create-task.dto.ts
import {
  IsString,
  IsOptional,
  IsDate,
  IsArray,
  IsEnum,
  IsBoolean,
  MinLength,
  MaxLength,
  ArrayMinSize,
  ValidateIf,
  IsNotEmpty,
  IsObject,
  ValidateNested,
  IsUUID,
  IsNumber,
  IsInt,
  Min,
  Max
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalStatus, TaskStatus } from '@prisma/client';

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;

  @IsOptional()
  @IsArray()
  category?: string[];

  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Invalid priority' })
  priority?: TaskPriority;

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'Each assignee must be a valid user ID' })
  @ArrayMinSize(0)
  assignees?: string[];

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  requiresApproval?: boolean;


  @IsOptional()
  @IsArray()
  uploads?: string[];
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;

  @IsOptional()
  @IsArray()
  category?: string[];

  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Invalid priority' })
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(TaskStatus, { message: 'Invalid status' })
  status?: TaskStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'Each assignee must be a valid user ID' })
  @ArrayMinSize(0)
  assignees?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Rejection reason cannot exceed 500 characters' })
  rejectionReason?: string;

  @IsOptional()
  @IsArray()
  uploads?: string[];

  // Custom validation: rejectionReason is required when status is CANCELLED
  @ValidateIf(o => o.status === TaskStatus.CANCELLED)
  @IsNotEmpty({ message: 'Rejection reason is required when cancelling a task' })
  requireRejectionReason?: string;

  @ValidateIf(o => o.status === TaskStatus.ISSUES)
  @IsNotEmpty({ message: 'Issue is required' })
  issue?: string;
}

class CreatedByDto {
  @IsUUID()
  id: string;

  @IsString()
  name: string;

  @IsString()
  email: string;

  @IsString()
  role: string;
}

class ApprovedByDto {
  @IsUUID()
  id: string;

  @IsString()
  name: string;

  @IsString()
  email: string;
}

class AssigneeDto {
  @IsUUID()
  id: string;

  @IsString()
  name: string;

  @IsString()
  email: string;

  @IsDate()
  @Type(() => Date)
  assignedAt: Date;
}

class FileDto {
  @IsUUID()
  id: string;

  @IsString()
  filename: string;

  @IsString()
  originalName: string;

  @IsString()
  mimetype: string;

  @IsNumber()
  size: number;

  @IsDate()
  @Type(() => Date)
  uploadedAt: Date;

  @IsOptional()
  @IsString()
  uri?: string;
}

export class TaskResponseDto {
  @IsUUID()
  id: string;

  @IsUUID()
  taskId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;

  @IsOptional()
  @IsArray()
  category?: string[];

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsEnum(TaskStatus)
  status: TaskStatus;

  @IsEnum(ApprovalStatus)
  approvalStatus: ApprovalStatus;

  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @IsDate()
  @Type(() => Date)
  updatedAt: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  approvalRequestedAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  approvedAt?: Date;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => CreatedByDto)
  createdBy: CreatedByDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ApprovedByDto)
  approvedBy?: ApprovedByDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssigneeDto)
  assignees: AssigneeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  files: FileDto[];
}

export class ApprovalRequestDto {
  @IsUUID('4', { message: 'Task ID must be a valid UUID' })
  taskId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one assignee is required for approval request' })
  @IsString({ each: true, message: 'Each assignee must be a valid user ID' })
  @IsNotEmpty({ each: true, message: 'Assignee IDs cannot be empty' })
  assignees: string[];
}

export class TaskQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Page must be at least 1' })
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsArray()
  category?: string[];

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Search term must not be empty' })
  search?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDateFrom?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDateTo?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDateFrom?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDateTo?: Date;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  @Type(() => String)
  sortOrder?: 'asc' | 'desc' = 'desc';
}

