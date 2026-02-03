import { AppraisalStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class KpiRatingDto {
  @IsString()
  @IsNotEmpty()
  objectiveId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;
}

export class UpdateKpiRatingDto {
  @IsNumber()
  @IsOptional()
  rating?: number;

  @IsString()
  @IsOptional()
  comment?: string;
}

export class GoalsAndAchievementDto {
  @IsArray()
  @IsString({ each: true })
  achievements: string[];

  @IsArray()
  @IsString({ each: true })
  goals: string[];
}

export class FeedbackQuestionDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsOptional()
  @IsString()
  response?: string;
}

export class FeedbackDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeedbackQuestionDto)
  questions: FeedbackQuestionDto[];
}

export class ObjectiveRatingDto {
  @IsString()
  objectiveId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class AppraisalObjectiveRatingDto {
  @IsString()
  appraisalObjId: string;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SendToDepartmentDto {
  @IsString()
  @IsNotEmpty()
  departmentId: string;

  @IsString()
  @IsNotEmpty()
  quarter: string;

  @IsNumber()
  year: number;
}

export class FillAppraisalDto {
  @IsString()
  @IsOptional()
  managerComment?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppraisalObjectiveRatingDto)
  objectiveRatings?: AppraisalObjectiveRatingDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GoalsAndAchievementDto)
  goalsAndAchievements?: GoalsAndAchievementDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeedbackQuestionDto)
  feedback?: FeedbackQuestionDto[];
}

// appraise-submission.dto.ts (same as before)
export class AppraiseSubmissionDto {
  @IsString()
  @IsNotEmpty()
  managerComment: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppraisalObjectiveRatingDto)
  objectiveRatings?: AppraisalObjectiveRatingDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GoalsAndAchievementDto)
  goalsAndAchievements?: GoalsAndAchievementDto;
}

// get-appraisals.dto.ts
export class GetAppraisalsDto {
  @IsOptional()
  @IsEnum(AppraisalStatus)
  status?: AppraisalStatus;

  @IsOptional()
  @IsString()
  quarter?: string;

  @IsOptional()
  @IsNumber()
  year?: number;

  // HR/Admin specific filters (ignored for Employee/Manager)
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class GetHRAppraisalsDto extends GetAppraisalsDto {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;
}
