import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  // async findAll() {
  //   return this.prisma.user.findMany({ include: { employment: true } });
  // }

  // async findOne(id: string) {
  //   return this.prisma.user.findUnique({ 
  //     where: { id },
  //     include: { employment: true },
  //   });
  // }

  // async findByEmail(email: string) {
  //   return this.prisma.user.findUnique({ 
  //     where: { email },
  //     include: { employment: true },
  //   });
  // }

  // async create(data: CreateUserDto) {
  //   return this.prisma.user.create({
  //     data: {
  //       email: data.email,
  //       firstName: data.firstName,
  //       lastName: data.lastName,
  //       phone: data.phone,
  //       gender: data.gender,
  //       role: (data.role as Role) || Role.USER, // still part of user (if desired)

  //       employment: {
  //         create: {
  //           role: data.employmentRole,
  //           department: data.department,
  //           jobType: data.jobType,
  //         },
  //       },
  //     },
  //     include: { employment: true }, // optional, helpful for response
  //   });
  // }

  // async findAcceptedInvite(email: string) {
  //   return this.prisma.invite.findFirst({
  //     where: {
  //       email,
  //       status: 'ACCEPTED',
  //     },
  //   });
  // }

  // async updateUser(id: string, data: UpdateUserDto) {
  //   try {
  //     // First find active user
  //   const user = await this.__findActiveUser(data.email);
  //   return await this.prisma.user.update({
  //     where: { id },
  //     data: {
  //       email: data.email || user.email,
  //       firstName: data.firstName || user.firstName,
  //       lastName: data.lastName || user.lastName,
  //       phone: data.phone || user.phone,
  //       gender: data.gender || user.gender,
  //       role: (data.role as Role) || user.role,

  //       employment: {
  //         update: {
  //           role: data.employmentRole || user.employment.role,
  //           department: data.department || user.employment.department,
  //           jobType: data.jobType || user.employment.jobType,
  //           contractLetter: data.contractLetter || user.employment.contractLetter,
  //           nda: data.nda || user.employment.nda,
  //           guarantorForm: data.guarantorForm || user.employment.guarantorForm,
  //            },       
  //         },
  //      },
  //      include: { employment: true }, // optional, helpful for response
  //   });
    
  //   } catch (error) {
  //     throw new BadRequestException(error.message);
  //   }
  // }



  //////////////////////////////// HELPER METHODS ////////////////////////////////

  // async __findActiveUser(email: string) {
  //   const user = await this.prisma.user.findUnique({
  //     where: {
  //       email,
  //       active: true,
  //     },
  //     include: { employment: true },  
  //   });
  //   if (!user) {
  //     throw new Error('User not found');
  //   }
  //   if (!user.active) {
  //     throw new Error('User is not active');
  //   }
  //   return user;  
  // }
}
