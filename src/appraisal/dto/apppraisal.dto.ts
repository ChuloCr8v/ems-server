import { PartialType } from "@nestjs/mapped-types";
import { AppraisalStatus, KpiCategoryType } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsDate, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from "class-validator";

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

export class UpdateAppraisalDto {
  @IsOptional()
  @IsString()
  managerComment?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KpiRatingDto)
  kpiRatings?: KpiRatingDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GoalsAndAchievementDto)
  goalsAndAchievements?: GoalsAndAchievementDto;

  @IsOptional()
  @IsBoolean()
  complete?: boolean = false;
}

export class RatingSummaryResponseDto {
  @IsNumber()
  technicalPerformance: number;

  @IsNumber()
  teamCollaboration: number;

  @IsNumber()
  initiativesLeadership: number;

  @IsNumber()
  departmentalKpi: number;

  @IsNumber()
  overallPerformance: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryBreakdownDto)
  categoryBreakdown: CategoryBreakdownDto[];
}

export class CategoryBreakdownDto {
  @IsString()
  categoryName: string;

  @IsNumber()
  averageRating: number;

  @IsNumber()
  totalObjectives: number;

  @IsNumber()
  ratedObjectives: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ObjectiveRatingDto)
  objectives: ObjectiveRatingDto[];
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
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ObjectiveRatingDto)
  objectiveRatings?: ObjectiveRatingDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GoalsAndAchievementDto)
  goalsAndAchievements?: GoalsAndAchievementDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeedbackQuestionDto)
  feedbackResponses?: FeedbackQuestionDto[];

  @IsOptional()
  @IsBoolean()
  submit?: boolean = false;
}

// appraise-submission.dto.ts (same as before)
export class AppraiseSubmissionDto {
  @IsString()
  @IsNotEmpty()
  managerComment: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ObjectiveRatingDto)
  objectiveRatings?: ObjectiveRatingDto[];

  @IsOptional()
  @IsBoolean()
  complete?: boolean = false;
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

  // @IsOptional()
  // @IsString()
  // employeeId?: string;
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