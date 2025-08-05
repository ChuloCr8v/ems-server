import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class LevelDto {
    @IsString()
    @IsNotEmpty({ message: 'Level Name is Required'})
    readonly name: string;

    @IsNotEmpty({ message: "Level Rank is Required"})
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