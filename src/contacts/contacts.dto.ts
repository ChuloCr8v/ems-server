import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ContactDto {
    @IsNotEmpty({ message: 'First Name is Required' })
    @IsString()
    firstName: string;

    @IsNotEmpty({ message: 'Last Name is Required' })
    @IsString()
    lastName: string;

    @IsNotEmpty({ message: 'Phone Number is Required' })
    @IsString()
    phone: string;

    @IsNotEmpty({ message: 'Address is Required' })
    @IsString()
    address: string;

    @IsOptional()
    @IsString()
    relationship?: string;

    @IsArray()
    @IsOptional()
    document?: string[];
}