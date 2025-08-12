import { JobType } from "@prisma/client";
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendInviteDto {
    @ApiProperty({
        example: "john.doe@example.com",
        description: "Email address of the person to send the invite to"
    })
    @IsNotEmpty()
    @IsEmail()
    readonly email: string;
}

export class CreateProspectDto {
    @ApiProperty({ example: "John", description: "First name of the prospect" })
    @IsNotEmpty({ message: 'First Name is Required' })
    @IsString()
    readonly firstName: string;

    @ApiProperty({ example: "Doe", description: "Last name of the prospect" })
    @IsNotEmpty({ message: 'Last Name is Required' })
    @IsString()
    readonly lastName: string;

    @ApiProperty({ example: "john.doe@example.com", description: "Email address of the prospect" })
    @IsNotEmpty({ message: 'Email is Required' })
    @IsEmail()
    readonly email: string;

    @ApiProperty({ example: "+2348012345678", description: "Phone number of the prospect" })
    @IsNotEmpty({ message: 'Phone Number is Required' })
    @IsString()
    readonly phone: string;

    @ApiProperty({ example: "Software Engineer", description: "Role of the prospect" })
    @IsNotEmpty({ message: 'Role is Required' })
    @IsString()
    readonly role: string;

    @ApiProperty({ example: "dept123", description: "Department ID" })
    @IsNotEmpty({ message: 'Department is Required' })
    readonly departmentId: string;

    @ApiProperty({ example: "2025-09-01", description: "Start date in YYYY-MM-DD format" })
    @IsNotEmpty({ message: 'Start Date is Required'})
    @IsString()
    startDate: Date;

    @ApiProperty({
        example: JobType.FULL_TIME,
        description: "Job type of the prospect",
        enum: JobType
    })
    @IsNotEmpty({ message: 'Job Type is Required' })
    @IsEnum(JobType, { each: true, message: 'Job Type must be one of the following: FULL_TIME, PART_TIME, CONTRACT' })
    readonly jobType: JobType;

    @ApiProperty({ example: "Male", description: "Gender of the prospect" })
    @IsNotEmpty({ message: 'Gender is Required' })
    @IsString()
    readonly gender: string;

    @ApiProperty({ example: "6 months", description: "Duration for contract staff" })
    @IsNotEmpty({ message: 'Duration is Required' })
    @IsString()
    readonly duration: string;
}

export class CreateUserDto {
    @ApiProperty({ example: "Nigeria", description: "Country of the user" })
    @IsString()
    @IsNotEmpty({ message: 'Country is Required' })
    readonly country: string;

    @ApiProperty({ example: "Lagos", description: "State of the user" })
    @IsString()
    @IsNotEmpty({ message: 'State is Required' })
    readonly state: string;

    @ApiProperty({ example: "123 Main Street", description: "Residential address of the user" })
    @IsString()
    @IsNotEmpty({ message: 'Address is Required' })
    readonly address: string;
}

export class DeclineComment {
    @ApiProperty({ example: "Not interested at the moment", description: "Reason for declining" })
    @IsString()
    @IsNotEmpty()
    comment: string;
}
