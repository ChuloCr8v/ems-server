import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAssetDto } from './dto/create-asset.dto';
import { PrismaService } from 'src/prisma/prisma.service';
// import { Role } from '@prisma/client';


@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAssetDto, ) {

    // currentUser: { id: string; role: Role }

    //  if (currentUser.role !== Role.ADMIN) {
    //   throw new ForbiddenException('Only admin can add assets');
    // }
    const user = await this.prisma.user.findUnique({
        where: { id: dto.assignedToId },
    });

if (!user) {
  throw new NotFoundException('Assigned user not found');
}

    return this.prisma.asset.create({
      data: {
        name: dto.name,
        category: dto.category,
        status: dto.status,
        dateAssigned: new Date(dto.dateAssigned),
        dateRetrieved: dto.dateRetrieved ? new Date(dto.dateRetrieved) : null,
        assignedTo: { connect: { id: dto.assignedToId } },
      },
    });
  }

//    async findAllAssets() {
//     return this.prisma.asset.findMany({
//       include: { assignedTo: true },
//     });
//   }

  async findByUser(userId: string) {
    return this.prisma.asset.findMany({
      where: { assignedToId: userId },
      orderBy: { dateAssigned: 'desc' },
    });
  }
}
