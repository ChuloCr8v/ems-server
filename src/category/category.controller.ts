import { Body, Controller, Post, Req } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CategoryService } from './category.service';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ReqPayload } from 'src/auth/dto/auth.dto';
import { CreateCategoryDto } from './category.dto';

@Controller('category')
export class CategoryController {
    constructor(private prisma: PrismaService, private category: CategoryService) { }

    @Auth(["ADMIN", "DEPT_MANAGER", "TEAM_LEAD"])
    @Post("category")
    async createTaskCategory(
        @Body() dto: CreateCategoryDto,
        @Req() req: ReqPayload

    ) {
        return this.category.create(req.user.id, dto);
    }

}
