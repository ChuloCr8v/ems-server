import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TasksService } from 'src/tasks/tasks.service';

@Module({
  providers: [PrismaService, TasksService, CategoryService,]
})
export class CategoryModule { }
