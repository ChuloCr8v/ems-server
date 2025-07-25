import { JobType } from "@prisma/client";
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsString } from "class-validator";

export class SendInviteDto {
    @IsNotEmpty()
    @IsEmail()
    readonly email: string;
}


export class CreateProspectDto {
    @IsNotEmpty({ message: 'First Name is Required' })
    @IsString()
    readonly firstName: string;

    @IsNotEmpty({ message: 'Last Name is Required' })
    @IsString()
    readonly lastName: string;

    @IsNotEmpty({ message: 'Email is Required' })
    @IsEmail()
    readonly email: string;

    @IsNotEmpty({ message: 'Phone Number is Required' })
    @IsString()
    readonly phone: string;

    @IsNotEmpty({ message: 'Role is Required' })
    @IsString()
    readonly role: string

    @IsNotEmpty({ message: 'Department is Required' })
    readonly departmentId: string;

    @IsNotEmpty({ message: 'Start Date is Required'})
    @IsString()
    startDate: Date;

    @IsNotEmpty({ message: 'Job Type is Required' })
    @IsEnum(JobType, { each: true, message: 'Job Type must be one of the following: FULL_TIME, PART_TIME, CONTRACT' })
    readonly jobType: JobType;

    @IsNotEmpty({ message: 'Gender is Required' })
    @IsString()
    readonly gender: string;

    @IsNotEmpty({ message: 'Duration is Required' })
    @IsString()
    readonly duration: string;
}

export class AcceptInviteDto {
    @IsNotEmpty({ message: 'Token is required' })
    @IsString()
    token: string;
}

export class CreateUserDto {
    @IsString()
    @IsNotEmpty({ message: 'Country is Required' })
    readonly country: string;

    @IsString()
    @IsNotEmpty({ message: 'State is Required' })
    readonly state: string;

    @IsString()
    @IsNotEmpty({ message: 'Address is Required' })
    readonly address: string;



}