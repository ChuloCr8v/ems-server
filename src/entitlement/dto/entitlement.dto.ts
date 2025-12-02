import { EntitlementType, EntitlementUnit } from "@prisma/client";
import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class EntitlementDto {
    @IsString()
    @IsNotEmpty({ message: "Entitlement name is required" })
    name: string;

    @IsEnum(EntitlementUnit, {
        message: "Entitlement unit must be a valid Entitlement Unit",
    })
    unit: EntitlementUnit;

    @IsEnum(EntitlementType, {
        message: "Entitlement type must be a valid Entitlement Type",
    })
    type: EntitlementType;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EntitlementLevelDto)
    @IsOptional()
    levels?: EntitlementLevelDto[];
}

export class EntitlementLevelDto {
    @IsString()
    @IsNotEmpty()
    levelId: string;

    @IsNumber()
    @IsNotEmpty()
    value: number;
}

export class UpdateEntitlementDto extends EntitlementDto { }
