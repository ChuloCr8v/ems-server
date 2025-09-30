import { JobType } from "@prisma/client";
import { IsArray, IsDate, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";


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
    readonly personalEmail: string;

    @ApiProperty({ example: "+2348012345678", description: "Phone number of the prospect" })
    @IsNotEmpty({ message: 'Phone Number is Required' })
    @IsString()
    readonly phone: string;

    @ApiProperty({ example: "Software Engineer", description: "Role of the prospect" })
    @IsNotEmpty({ message: 'Role is Required' })
    @IsString()
    readonly role: string;

    @ApiProperty({ example: "dept123", description: "Department ID" })
    @IsOptional()
    @IsArray()
    readonly departments?: string[];

    @ApiProperty({ example: "2025-09-01", description: "Start date in YYYY-MM-DD format" })
    @IsNotEmpty({ message: 'Start Date is Required' })
    @IsDate()
    @Transform(({ value }) => new Date(value))
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

    //Duration for CONTRACT-STAFF
    @ApiProperty({ example: "6 months", description: "Duration for contract staff" })
    // @IsNotEmpty({ message: 'Duration is Required' })
    @IsString()
    @IsOptional()
    readonly duration?: string;
}


export class DeclineComment {
    @ApiProperty({ example: "Not interested at the moment", description: "Reason for declining" })
    @IsString()
    @IsOptional()
    comment?: string;
}
