import { ExitType } from "@prisma/client";
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class InitiateExit {
    @IsString()
    @IsNotEmpty()
    employeeId: string;

    @IsEnum(ExitType, { each: true, message: 'Exit Type must be one of the following: RESIGNATION, TERMINATION' })
    @IsNotEmpty()
    type: ExitType;

    @IsString()
    @IsNotEmpty()
    reason: string;

    @IsString()
    @IsNotEmpty()
    relievingDate: Date;

    @IsString()
    @IsNotEmpty()
    resignationDate: Date;

    @IsBoolean()
    @IsNotEmpty()
    noticePeriod?: boolean;

    @IsOptional()
    @IsArray()
    uploads?: string[];
}

export class HandoverTaskDto {
    @IsString()
    @IsNotEmpty()
    toUserId: string;

    // @IsString()
    // @IsNotEmpty()
    // fromUserId: string;

    @IsString()
    @IsOptional()
    note?: string;

    @IsArray()
    @IsOptional()
    uploads?: string[];

    @IsString()
    @IsNotEmpty()
    signatureId: string;
}

export class DepartmentClearanceDto {
    @IsString()
    @IsNotEmpty()
    signatureId: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class UploadHandoverSignatureDto {
    @IsString()
    @IsNotEmpty()
    signatureId: string;

    @IsString()
    @IsNotEmpty()
    handoverUserId: string; // The user they are receiving the task from
}
