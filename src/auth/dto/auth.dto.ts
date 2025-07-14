import { IsString } from 'class-validator';

export class AzureAuthDto {
  @IsString()
  token: string;
}
