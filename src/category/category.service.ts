import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { bad, mustHave } from 'src/utils/error.utils';
import { CreateCategoryDto } from './category.dto';
import { IdGenerator } from 'src/utils/IdGenerator.util';
import { TasksService } from 'src/tasks/tasks.service';
import { CategoryType } from '@prisma/client';

@Injectable()
export class CategoryService {
    constructor(private prisma: PrismaService, private task: TasksService) { }

    async create(userId: string, dto: CreateCategoryDto) {
        const { department, title, description, color, type } = dto
        try {
            const createdBy = await this.prisma.user.findUnique({
                where: {
                    id: userId
                },
            })

            if (!createdBy) mustHave(createdBy, "User not found", 404)

            const categoryExists = await this.prisma.category.findUnique({
                where: {
                    title
                }
            })

            if (categoryExists) bad(`${title} already created`)
            if (department) {
                const deptExists = await this.prisma.department.findMany({ where: { id: { in: department } } })

                if (deptExists.length < department.length) bad("One or more departments not found")
            }

            const res = await this.prisma.category.create({
                data: {
                    categoryId: IdGenerator("CAT"),
                    type,
                    title,
                    description: description || undefined,
                    color: color || "gray",
                    departments: { connect: department.map((id) => ({ id })) },
                    createdBy: { connect: { id: userId } }
                },
            })

            return {
                message: title + " " + "created successfully",
                data: res
            }
        } catch (error) {
            bad(error)
        }
    }

    async listCategories(type: CategoryType) {
        try {
            return await this.prisma.category.findMany({
                where: {
                    type
                },
                orderBy: {
                    createdAt: 'desc'
                },
                select: {
                    tasks: type === CategoryType.Task ? { include: this.task.getTaskInclude() } : null
                }
            });
        } catch (error) {
            bad(error)
        }
    }
}
