import {
    applyDecorators,
    createParamDecorator,
    ExecutionContext,
    UseGuards,
  } from '@nestjs/common';
  import { JwtAuthGuard } from '../guards/jwt-auth.guard';
  import { User, Role } from '@prisma/client';
  import { Roles } from './roles.decorator';
  import { RolesGuard } from '../guards/roles.guards';
  
  export const Auth = (roles?: Role[]) => {
    if (!roles?.length) return applyDecorators(UseGuards(JwtAuthGuard));
    return applyDecorators(Roles(...roles), UseGuards(JwtAuthGuard, RolesGuard));
  };
  
  export const GetAuthUser = createParamDecorator(
    (data, ctx: ExecutionContext): User => {
      const req = ctx.switchToHttp().getRequest();
      return req.user;
    },
  );
  