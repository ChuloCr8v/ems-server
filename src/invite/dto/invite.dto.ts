import { JobType } from "@prisma/client";
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsString } from "class-validator";

export class SendInviteDto {
    @IsNotEmpty()
    @IsEmail()
    readonly email: string;
}


export class CreateProspectDto {
    @IsNotEmpty({ message: 'First Name is Required'})
    @IsString()
    firstName: string;

    @IsNotEmpty({ message: 'Last Name is Required'})
    @IsString()
    lastName: string;

    @IsNotEmpty({ message: 'Email is Required'})
    @IsEmail()
    email: string;

    @IsNotEmpty({ message: 'Phone Number is Required'})
    @IsString()
    phone: string;

    @IsNotEmpty({ message: 'Role is Required'})
    @IsString()
    role: string

    @IsNotEmpty({ message: 'Department is Required'})
    departmentId: string;

    @IsNotEmpty({ message: 'Job Type is Required'})
    @IsEnum(JobType, { each: true, message: 'Job Type must be one of the following: FULL_TIME, PART_TIME, CONTRACT' })
    jobType: JobType;

    @IsNotEmpty({ message: 'Gender is Required'})
    @IsString()
    gender: string;

    @IsNotEmpty({ message: 'Duration is Required'})
    @IsString()
    duration: string;
}