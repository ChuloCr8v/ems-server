import { JobType, MaritalStatus, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export class EmergencyContactDto {
    @IsNotEmpty({ message: 'First Name is Required' })
    @IsString()
    firstName: string;

    @IsNotEmpty({ message: 'Last Name is Required' })
    @IsString()
    lastName: string;

    @IsNotEmpty({ message: 'Email is Required' })
    @IsEmail()
    email: string;

    @IsNotEmpty({ message: 'Phone Number is Required' })
    @IsString()
    phone: string;
}


export class GuarantorContactDto {
    @IsNotEmpty({ message: 'First Name is Required' })
    @IsString()
    firstName: string;

    @IsNotEmpty({ message: 'Last Name is Required' })
    @IsString()
    lastName: string;

    @IsNotEmpty({ message: 'Email is Required' })
    @IsEmail()
    email: string;

    @IsNotEmpty({ message: 'Phone Number is Required' })
    @IsString()
    phone: string;
}


export class CreateUserDto {
    @IsNotEmpty({ message: 'First Name is Required' })
    @IsString()
    firstName: string;

    @IsNotEmpty({ message: 'Last Name is Required' })
    @IsString()
    lastName: string;

    @IsNotEmpty({ message: 'Phone Number is Required' })
    @IsString()
    phone: string;

    @IsNotEmpty({ message: 'Role is Required' })
    @IsString()
    role: string

    @IsNotEmpty({ message: 'Job Type is Required' })
    @IsEnum(JobType, { each: true, message: 'Job Type must be one of the following: FULL_TIME, CONTRACT' })
    jobType: JobType;

    @IsNotEmpty({ message: 'Gender is Required' })
    @IsString()
    gender: string;

    @IsNotEmpty({ message: 'Duration is Required' })
    @IsString()
    duration: string;

    @IsNotEmpty({ message: 'Start Date is Required' })
    @IsString()
    startDate: Date;

    @ValidateNested()
    @Type(() => GuarantorContactDto)
    guarantor: GuarantorContactDto;

    @ValidateNested()
    @Type(() => EmergencyContactDto)
    emergency: EmergencyContactDto;

    @IsNotEmpty({ message: 'Marital Status is Required' })
    @IsEnum(MaritalStatus, { each: true, message: 'Marital Status must be one of the following: SINGLE, MARRIED' })
    maritalStatus: MaritalStatus;

    @IsString()
    @IsNotEmpty({ message: 'Address is Required' })
    address: string;

    @IsString()
    @IsNotEmpty({ message: 'Country is Required' })
    country: string;

    @IsString()
    @IsNotEmpty({ message: 'State is Required' })
    state: string;
}

export class UpdateUserDto extends CreateUserDto { }

export class ApproveUserDto {
    @IsEmail()
    @IsNotEmpty({ message: 'Work Email is Required' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'Work Phone Number is Required' })
    workPhone: string;

    @IsString()
    @IsNotEmpty({ message: 'Level is Required' })
    levelId: string;

    @IsString()
    @IsNotEmpty({ message: 'Employee ID Number is Required' })
    eId: string;

    @IsEnum(Role, { each: true })
    @IsNotEmpty({ message: 'User Role is Required' })
    userRole: Role;
}


export class UpdateUserInfo {
    @IsString()
    @IsNotEmpty()
    comment: string;
}