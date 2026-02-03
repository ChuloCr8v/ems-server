import { Role, User } from '@prisma/client';
import { IsString } from 'class-validator';

export class AzureAuthDto {
  @IsString()
  token: string;
}

export type AuthPayload = {
  sub: string;
  email: string;
  role: Role[];
};

export type IAuthUser = AuthPayload;

export type ReqPayload = {
  user: User;
  userRole: Role[];
};
