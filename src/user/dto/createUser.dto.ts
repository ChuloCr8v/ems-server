import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  phone: string;

  @IsString()
  gender: string;

  @IsOptional()
  @IsString()
  role?: string; // e.g. 'ADMIN', 'USER'

  // Employment fields
  @IsOptional()
  @IsString()
  employmentRole?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  jobType?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsString()
  contractLetter?: string;

  @IsOptional()
  @IsString()
  nda?: string;

  @IsOptional()
  @IsString()
  guarantorForm?: string;
}
