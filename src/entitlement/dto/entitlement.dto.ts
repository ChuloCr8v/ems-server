import { IsNotEmpty, IsString } from "class-validator";

export class EntitlementDto {
    @IsString()
    @IsNotEmpty({ message: 'Entitlement name is required'})
    name: string;

    @IsString()
    @IsNotEmpty({ message: 'Entitlement unit is required'})
    unit: string;
}

export class UpdateEntitlement extends EntitlementDto {}