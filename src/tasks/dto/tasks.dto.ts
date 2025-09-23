// src/performance/dto/create-task.dto.ts
import { IsOptional, IsString, IsDate, IsEnum, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { Priority, TaskStatus } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';


export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignees?: string[];
}

// src/performance/dto/update-task.dto.ts


export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

// src/performance/dto/task-response.dto.ts

export class TaskFileResponseDto {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadedAt: Date;
}

export class AssigneeResponseDto {
  id: string;
  name: string;
  email: string;
  assignedAt: Date;
}

export class TaskResponseDto {
  id: string;
  title: string;
  description?: string;
  startDate?: Date;
  dueDate?: Date;
  category?: string;
  priority?: Priority;
  status?: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  assignees: AssigneeResponseDto[];
  files: TaskFileResponseDto[];
}