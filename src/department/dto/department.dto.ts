import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class DepartmentDto {
    @IsString()
    @IsNotEmpty()
    name: string

    @IsString()
    @IsOptional()
    departmentHead?: string

    @IsString()
    @IsNotEmpty()
    createdBy: string
}
