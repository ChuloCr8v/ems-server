import { SalaryCalculationType, SalaryType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from "class-validator";


export class AddComponentDto {
    @IsNumber()
    amount: number;

    @IsEnum(SalaryType, { each: true } )
    type: SalaryType;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsEnum(SalaryCalculationType, { each: true } )
    calculations: SalaryCalculationType;
    
    @IsOptional()
    @IsNumber()
    duration?: number;

    @IsOptional()
    startDate?: Date;
}

export class PayrollDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsNumber()
    salary: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AddComponentDto)
    components?: AddComponentDto[];
}

export class UpdatePayrollDto {
    @IsOptional()
    @IsNumber()
    salary: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AddComponentDto)
    components?: AddComponentDto[];
}