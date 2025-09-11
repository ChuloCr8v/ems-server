import { EntitlementUnit } from "@prisma/client";
import { IsNotEmpty, IsString } from "class-validator";

export class EntitlementDto {
    @IsString()
    @IsNotEmpty({ message: 'Entitlement name is required' })
    name: string;

    @IsString()
    @IsNotEmpty({ message: 'Entitlement unit is required' })
    unit: EntitlementUnit;
}

export class UpdateEntitlement extends EntitlementDto { }