import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { LevelDto, UpdateLevelDto } from './dto/level.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class LevelService {
    constructor(private prisma: PrismaService) {}

    async createLevel(input: LevelDto) {
        try {
            const { name, rank } = input;
            const level = await this.prisma.level.create({
                data: {
                    name,
                    rank,
                },
            });
            return level;
        } catch (error) {
        //    console.error(error)
          throw new BadRequestException(error.message);
        }
 }

    async getAllLevels() {
        try {
            return await this.prisma.level.findMany();
        } catch (error) {
           throw new BadRequestException(error.message);
        }
    }

    async getOneLevel(id: string){
        try {
            const level = await this.__findOneLevel(id);
            return level
        } catch (error) {
            throw new BadRequestException(error.message);  
        }
    }

    async updateLevel(id: string, update: UpdateLevelDto) {
        const { name, rank } = update;
        try {
            await this.__findOneLevel(id);
            return await this.prisma.level.update({
                where: { id },
                data: {
                    name,
                    rank
                }
            })
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }



    ////////////////////////////  HELPERS  ///////////////////////
    async __findOneLevel(id: string) {
        const level = await this.prisma.level.findUnique({
            where: { id },
        });
        if (!level) {
            throw new BadRequestException('Level not found');
        }
        return level;
    }
}
