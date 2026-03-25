import { AppraisalPipStatus, AppraisalStatus } from '@prisma/client';
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
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  categoryName: string;

  @IsString()
  @IsNotEmpty()
  objective: string;

  @IsOptional()
  @IsString()
  templateCategoryId?: string;

  @IsOptional()
  @IsString()
  templateObjectiveId?: string;

  @IsString()
  @IsOptional()
  actualResult?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsString()
  @IsOptional()
  comment?: string;
}

export class UpdateKpiRatingDto extends KpiRatingDto {

}

export class GoalsDto {
  @IsString()
  goal: string;

  @IsString()
  outcome: string;

  @IsNumber()
  timeline: number;

}

export class AchievementsDto {
  @IsString()
  title: string;
}

export class CompetencyAssessmentDto {
  @IsString()
  objectiveId?: string;

  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsString()
  actualResult?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class LeadershipAssessmentDto {
  @IsString()
  leadershipItemId?: string;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class DevelopmentNeedsDto {
  @IsString()
  title?: string;

  @IsString()
  supportRequired?: string;

  @IsOptional()
  @IsNumber()
  timeline?: number;
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

export class SignatureDto {
  @IsString()
  @IsOptional()
  employeeSignature?: string;

  @IsString()
  @IsOptional()
  managerSignature?: string;

  @IsString()
  @IsNotEmpty()
  employeeDate: string;

  @IsString()
  @IsNotEmpty()
  managerDate: string;
}

export class AppraisalPipDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  employeeComment?: string;

  @IsString()
  @IsOptional()
  managerComment?: string;

  @IsEnum(AppraisalPipStatus)
  @IsOptional()
  status?: AppraisalPipStatus;
}

export class FillAppraisalDto {
  @IsString()
  @IsOptional()
  managerComment?: string;

  @IsString()
  @IsOptional()
  employeeComment?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KpiRatingDto)
  kpi?: KpiRatingDto[];

  @IsOptional()
  @IsArray()
  competencyAssessment?: CompetencyAssessmentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeadershipAssessmentDto)
  leadershipAssessment?: LeadershipAssessmentDto[];

  @IsOptional()
  @IsArray()
  achievements?: string[];

  @IsOptional()
  @IsArray()
  goals?: GoalsDto[];

  @IsOptional()
  @IsArray()
  developmentNeeds?: DevelopmentNeedsDto[];

  @IsOptional()
  @Type(() => SignatureDto)
  signatures?: SignatureDto;

}

// appraise-submission.dto.ts (same as before)
export class AppraiseSubmissionDto {
  @IsString()
  @IsNotEmpty()
  managerComment: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompetencyAssessmentDto)
  competencyAssessment?: CompetencyAssessmentDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GoalsDto)
  goals?: GoalsDto;


  @IsOptional()
  @ValidateNested()
  @Type(() => AchievementsDto)
  achievements?: AchievementsDto;

  @IsOptional()
  @Type(() => SignatureDto)
  signatures?: SignatureDto;
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
