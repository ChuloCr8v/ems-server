import { IsNotEmpty, IsString } from "class-validator";

export class DepartmentDto {
    @IsString()
    @IsNotEmpty()
    name: string
}
