import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [UploadsController],
    providers: [UploadsService, PrismaService],
    exports: [UploadsService],
})
export class UploadsModule { }
