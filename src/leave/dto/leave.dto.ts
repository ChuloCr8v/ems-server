import { Transform } from "class-transformer";
import { IsDate, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateLeaveRequestDto {
    @IsString()
    @IsNotEmpty()
    typeId: string;

    @IsString()
    @IsNotEmpty()
    doaId: string;

    @IsString()
    @IsNotEmpty()
    reason: string;

    @IsDate()
    @Transform(({ value }) => new Date(value))
    @IsNotEmpty()
    startDate: Date;

    @IsDate()
    @Transform(({ value }) => new Date(value))
    @IsNotEmpty()
    endDate: Date;

    @IsString()
    @IsOptional()
    uploads: string[];

}