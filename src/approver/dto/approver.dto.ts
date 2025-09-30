import { ApproverRole } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class ApproverInputDto {
    @IsNotEmpty()
    @IsString()
    userId: string;

    @IsOptional()
    @IsString()
    departmentId?: string;

    @IsEnum(ApproverRole, { each: true })
    @IsNotEmpty({ message: 'Approver role is required'})
    role: ApproverRole;
}