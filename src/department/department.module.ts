import { Module } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { DepartmentController } from './department.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [DepartmentController],
  providers: [DepartmentService, PrismaService, JwtService],
})
export class DepartmentModule {}
