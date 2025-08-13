import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InitiateExit } from './dto/offboarding.dto';
import { UserService } from 'src/user/user.service';
import { Status } from '@prisma/client';

@Injectable()
export class OffboardingService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly user: UserService,
    ) {}

async initiateExit(userId: string, data: InitiateExit, uploads: Express.Multer.File[]) {
  const { type, reason, lastWorkDate, noticePeriod } = data;

  try {
    // 1. Verify user is ACTIVE
    const user = await this.user.__findUserById(userId);
    if (user.status !== Status.ACTIVE) {
      throw new BadRequestException('User is not active');
    }

    // 2. Create offboarding record (ensure `userId` is valid)
    const exit = await this.prisma.offboarding.create({
      data: {
        type,
        reason,
        lastWorkDate,
        noticePeriod,
        user: {
          connect: {
            id: userId, 
          },
        },
      },
      include: {
        user: true,
      },
    });

    // 3. Handle file uploads (if any)
    if (uploads?.length > 0) {
      const exitUploads = uploads.map((upload) => ({
        name: upload.originalname,
        size: upload.size,
        type: upload.mimetype,
        bytes: upload.buffer,
        offboardingId: exit.id,
      }));

      await this.prisma.upload.createMany({
        data: exitUploads,
      });

      return { exit, exitUploads };
    }

    return { exit };
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new InternalServerErrorException('Failed to initiate exit process');
  }
}
}
