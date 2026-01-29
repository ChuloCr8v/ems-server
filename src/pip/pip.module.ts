import { Module } from '@nestjs/common';
import { PipService } from './pip.service';
import { PipController } from './pip.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
// import { DepartmentModule } from 'src/department/department.module';
import { DepartmentService } from 'src/department/department.service';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [PipController],
  providers: [PipService, DepartmentService],
})
export class PipModule {}
