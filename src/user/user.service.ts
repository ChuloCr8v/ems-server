import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { CreateUserDto } from './dto/createUser.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({ include: { employment: true } });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({ 
      where: { id },
      include: { employment: true },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ 
      where: { email },
      include: { employment: true },
    });
  }

  async create(data: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        gender: data.gender,
        role: (data.role as Role) || Role.USER, // still part of user (if desired)

        employment: {
          create: {
            role: data.employmentRole,
            department: data.department,
            jobType: data.jobType,
            contractLetter: data.contractLetter,
            nda: data.nda,
            guarantorForm: data.guarantorForm,
          },
        },
      },
      include: { employment: true }, // optional, helpful for response
    });
  }

  async findAcceptedInvite(email: string) {
    return this.prisma.invite.findFirst({
      where: {
        email,
        status: 'ACCEPTED',
      },
    });
  }
}
