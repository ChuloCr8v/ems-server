import { IsEmail, IsString, Length } from 'class-validator';

export const MAIL_SUBJECT = {
  SET_PASSWORD: 'Set Account Password',
  ACCOUNT_VERIFICATION: 'Account Verification',
  PASSWORD_RESET: 'Password Reset',
};

export class ApplicantOtpMailDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  @Length(6)
  otp: string;
}

export class StaffPasswordResetDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  password: string;
}

export class ForgotPasswordResetDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  token: string;
}
