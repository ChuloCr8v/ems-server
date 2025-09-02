import { ExitType } from "@prisma/client";
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

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


export class ReturnAsset {
    @IsString()
    @IsNotEmpty()
    condition: string;

    @IsString()
    @IsNotEmpty()
    reason: string;
}

// export class ReportAssetDto {
//     @IsString()
//     @IsNotEmpty()
//     comment: string;
// }

export class DebtPaymentDto {
    @IsString()
    @IsOptional()
    notes?: string;
}