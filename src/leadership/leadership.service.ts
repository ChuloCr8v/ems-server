import { Injectable } from '@nestjs/common';
import { createLeadershipAssessmentItemDto } from './leadership.dto';
import { bad } from 'src/utils/error.utils';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class LeadershipService {
    constructor(private prisma: PrismaService) { }

    async createLeadershipAssessmentItem(body: createLeadershipAssessmentItemDto) {
        try {
            const titles = body.items.map(item => item.title);

            const existingItems = await this.prisma.appraisalLeadership.findMany({
                where: {
                    title: { in: titles },
                },
            });

            if (existingItems.length) {
                throw bad(`Some items already exist: ${existingItems.map(i => i.title).join(', ')}`);
            }

            // Create new items
            const createdItems = await Promise.all(
                body.items.map(item =>
                    this.prisma.appraisalLeadership.create({
                        data: { title: item.title },
                    }),
                ),
            );

            return createdItems;
        } catch (error) {
            bad(error);
        }
    }


    async listLeadershipAssessmentItem() {
        try {
            return await this.prisma.appraisalLeadership.findMany({})
        } catch (error) {
            bad(error)
        }
    }
}