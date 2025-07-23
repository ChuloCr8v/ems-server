import { IsString } from 'class-validator';

export class AzureAuthDto {
  @IsString()
  token: string;
}

export type AuthPayload = {
  sub: string;
  email: string;
  role: string;
}

export type IAuthUser = AuthPayload;
