import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class LevelDto {
    @IsString()
    @IsNotEmpty()
    readonly name: string;

    @IsNotEmpty()
    @IsNumber()
    readonly rank: number;
}

export class UpdateLevelDto {
    @IsString()
    @IsOptional()
    readonly name: string;

    @IsOptional()
    @IsNumber()
    readonly rank: number;
}