import { CategoryType } from '@prisma/client';
import { IsString, IsOptional, MaxLength, IsDate, IsArray, IsEnum, ArrayMinSize, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateCategoryDto {
    @IsString()
    title: string;

    @IsNotEmpty()
    @IsArray()
    department: string[];

    @IsOptional()
    @IsString()
    @MaxLength(300, { message: 'Description cannot exceed 300 characters' })
    description?: string;

    @IsOptional()
    @IsString()
    color?: string;

    @IsOptional()
    @IsString()
    type?: CategoryType;

}