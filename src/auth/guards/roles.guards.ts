import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { approver: true },
    });

    if (!dbUser) return false;

    let effectiveRoles = [...(dbUser.userRole || [])];

    if (dbUser.approver?.length > 0) {
      effectiveRoles.push(Role.DEPT_MANAGER);
    }

    return effectiveRoles.some((role) => requiredRoles.includes(role));

  }
}
