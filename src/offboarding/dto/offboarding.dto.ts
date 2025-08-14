import { ExitType } from "@prisma/client";
import { IsBoolean, IsEnum, IsNotEmpty, IsString } from "class-validator";

export class InitiateExit {
    @IsEnum( ExitType, { each: true, message: 'Exit Type must be one of the following: RESIGNATION, TERMINATION'})
    @IsNotEmpty()
    type: ExitType;

    @IsString()
    @IsNotEmpty()
    reason: string;

    @IsString()
    @IsNotEmpty()
    lastWorkDate: Date;

    @IsBoolean()
    @IsNotEmpty()
    noticePeriod: boolean;
}