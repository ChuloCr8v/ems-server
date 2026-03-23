import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { EmailTo } from '@prisma/client';

export class SendEmailDto {
  @IsEnum(EmailTo)
  @IsNotEmpty()
  to: EmailTo;

  @IsArray()
  @IsOptional()
  recipients?: string[];

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsArray()
  @IsOptional()
  @IsUUID('4', { each: true })
  attachments?: string[];
}
