import { PartialType } from "@nestjs/mapped-types";
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class DepartmentDto {
    @IsString()
    @IsNotEmpty()
    name: string

    @IsString()
    @IsOptional()
    departmentHead?: string

    @IsString()
    @IsOptional()
    teamLead?: string

    @IsString()
    @IsNotEmpty()
    createdBy: string
}

export class CreateTeamDto extends PartialType(DepartmentDto) {
    @IsArray()
    @IsOptional()
    userIds?: string[]
}