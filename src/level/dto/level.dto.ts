import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";

export class LevelDto {
    @IsString()
    @IsNotEmpty({ message: 'Level Name is Required' })
    readonly name: string;

    @IsNotEmpty({ message: "Level Rank is Required" })
    @IsNumber()
    readonly rank: number;

    @IsArray()
    @ValidateNested({ each: true })
    @IsOptional()
    @Type(() => LevelEntitlementDto)
    readonly entitlements?: LevelEntitlementDto[];

}

export class LevelEntitlementDto {
    @IsString()
    @IsNotEmpty({ message: 'Entitlement ID is Required' })
    readonly entitlementId: string;

    @IsNumber()
    @IsNotEmpty({ message: 'Entitlement Value is Required' })
    readonly value?: number;
}

export class UpdateLevelDto {
    @IsString()
    @IsOptional()
    readonly name?: string;

    @IsOptional()
    @IsNumber()
    readonly rank?: number;

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => LevelEntitlementDto)
    readonly entitlements?: LevelEntitlementDto[];
}