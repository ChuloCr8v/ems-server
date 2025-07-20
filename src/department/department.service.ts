import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentService {
    constructor( private prisma: PrismaService){}
    async createDepartment(input: DepartmentDto) {
        try {
            const { name } = input;
            const department = await this.prisma.department.create({
                data: { name }
            });
            return department;
        } catch (error) {
            throw new InternalServerErrorException(`Failed to create department ${error.message}`);
        }
    }

    async getAllDepartment(){
        try {
            return await this.prisma.department.findMany();
        } catch (error) {
            throw new InternalServerErrorException(`Failed to get all departments ${error.message}`);
        }
    }

    async getOneDepartment(id: string){
        try {
            const department = await this.prisma.department.findUnique({
                where: { id },
            });
            return department;
        } catch (error) {
            throw new InternalServerErrorException(`Failed to get department ${error.message}`);
        }
    } 

    async updateDepartment(id: string, update: DepartmentDto) {
        const { name } = update;
        try {
            const department = await this.__findOneDepartment(id);
            if(!department) {
                throw new NotFoundException("Department Not Found");
            };
            return await this.prisma.department.update({
                where: { id },
                data: { name }
            });
        } catch (error) {
            throw new InternalServerErrorException(`Failed to update department ${error.message}`);
        }
    }

    async deleteDepartment(id: string) {
        try {
            const department = await this.__findOneDepartment(id);
            if(!department) {
                throw new NotFoundException("Department Not Found");
            }
            return await this.prisma.department.delete({
                where: { id },
            });
        } catch (error) {
            throw new InternalServerErrorException(`Failed to delete department ${error.message}`);
        }
    }
    
    ///////////////////////// Helper Functions ////////////////////
    async __findOneDepartment(id: string){
        return await this.prisma.department.findUnique({ where: { id } });
    }
}
