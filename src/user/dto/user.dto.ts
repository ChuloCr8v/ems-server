import { JobType, MaritalStatus, Role, Status } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsDate, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { ContactDto } from 'src/contacts/contacts.dto';

export class CreateUserDto {
  @IsString()
  @IsOptional()
  eId?: string;

  @IsString()
  @IsOptional()
  email?: string;


  @IsString()
  @IsOptional()
  workPhone?: string;

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

  @IsOptional({ message: 'Duration is Required' })
  @IsString()
  duration?: string;

  @IsNotEmpty({ message: 'Start Date is Required' })
  @IsDate()
  @Transform(({ value }) => new Date(value))
  startDate: Date;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  dateOfBirth?: Date;

  @ValidateNested({ each: true })
  @IsArray()
  @Type(() => ContactDto)
  guarantor: ContactDto[];

  @ValidateNested({ each: true })
  @IsArray()
  @Type(() => ContactDto)
  emergency: ContactDto[];

  @ValidateNested({ each: true })
  @IsArray()
  @Type(() => ContactDto)
  nextOfKin: ContactDto[];

  @IsNotEmpty({ message: 'Marital Status is Required' })
  @IsEnum(MaritalStatus, { each: true, message: 'Marital Status must be one of the following: SINGLE, MARRIED' })
  maritalStatus: MaritalStatus;

  @IsString()
  @IsNotEmpty({ message: 'Address is Required' })
  address: string;

  @IsString()
  @IsOptional()
  levelId: string;

  @IsString()
  @IsNotEmpty({ message: 'Country is Required' })
  country: string;

  @IsString()
  @IsNotEmpty({ message: 'State is Required' })
  state: string;

  @IsArray()
  @IsOptional()
  userDocuments: string[];

  @IsArray()
  @IsOptional()
  userRole?: Role[];

}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  status: Status;
  departments: string[];
}
export class ApproveUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Level is Required' })
  levelId: string;

  @IsOptional()
  @IsEnum(Role, { each: true })
  userRole?: Role[];
}


export class UpdateUserInfo {
  @IsString()
  @IsNotEmpty()
  comment: string;
}

// add-employee.dto.ts

export class
  AddEmployeeDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;


  @IsOptional()
  @IsString()
  personalEmail?: string;


  @IsOptional()
  @IsString()
  workPhone?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNotEmpty()
  @IsString()
  gender: string;

  @IsNotEmpty()
  @IsArray()
  department: string[];

  @IsOptional()
  @IsString()
  level: string;

  @IsNotEmpty()
  @IsEnum(JobType)
  jobType: JobType;

  @IsNotEmpty()
  @IsString()
  role: string;

  @IsOptional()
  @IsEnum(Role, { each: true })
  userRole?: Role[];

  @IsOptional()
  @IsString()
  eId?: string;

  @IsOptional()
  @IsString()
  duration?: string;
}