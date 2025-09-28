import { IsNotEmpty, IsString } from "class-validator";

export class BankDto {
    @IsString()
    @IsNotEmpty()
    bankName: string

    @IsString()
    @IsNotEmpty()
    accountName: string

    @IsString()
    @IsNotEmpty()
    accountNumber: string
}