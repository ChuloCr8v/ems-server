import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { CreateUserDto } from './dto/user.dto';
import { InviteService } from 'src/invite/invite.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService, private readonly invite: InviteService) {}

  async createUser(id: string, data: CreateUserDto, uploads: Express.Multer.File[]) {
    try {
      //First find prospect by ID
      const prospect = await this.invite.__findProspectById(id);
      // console.log(prospect);

     const result =  await this.prisma.$transaction(async (prisma) => {
         // Create user
            const user = await prisma.user.create({
                data: {
                    firstName: prospect.firstName,
                    lastName: prospect.lastName,
                    gender: prospect.gender,
                    duration: prospect.duration,
                    phone: prospect.phone,
                    role: prospect.role,
                    jobType: prospect.jobType,
                    startDate: prospect.startDate,
                    department: {
                        connect: {
                            id: prospect.departmentId,
                        },
                    },
                    country: data.country,
                    state: data.state,  
                    address: data.address,
                    maritalStatus: data.maritalStatus,
                    contacts: {
                        create: {
                            gurantor: {
                                create: {
                                    firstName: data.guarantor.firstName,
                                    lastName: data.guarantor.lastName,
                                    phone: data.guarantor.phone,
                                    email: data.guarantor.email
                                },
                            },
                            emergency: {
                                create: {
                                    firstName: data.emergency.firstName,
                                    lastName: data.emergency.lastName,
                                    phone: data.emergency.phone,
                                    email: data.emergency.email,
                                },
                            },
                        },
                    },
                    prospect: {
                        connect: {
                            id: prospect.id,
                        },
                    },
                },
                include: {
                    contacts: true,
                    prospect: true
                },
            });
            // Handle file uploads within the transaction
            if (uploads?.length > 0) {
                const userUploads = uploads.map((upload) => ({
                    name: upload.originalname,
                    size: upload.size,
                    type: upload.mimetype,
                    bytes: upload.buffer,
                    userId: user.id,
                }));

                await prisma.upload.createMany({
                    data: userUploads,
                });
            }
      return { user, uploads }
      });
      
      return result;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

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
