import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
  UseGuards,
  SetMetadata,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type Request } from 'express';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guards';
import { ROLES_KEY } from './roles.decorator';
import { Role } from '@prisma/client';

export function Auth(roles?: Role[]) {
  if (!roles?.length) {
    return applyDecorators(UseGuards(AuthGuard));
  }
  return applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(AuthGuard, RolesGuard),
  );
}

export function getAuthToken(req: Request) {
  const auth = req.headers.authorization;
  const bearer = auth && /^Bearer (.+)$/.exec(auth);
  if (bearer) return bearer[1];

  const header = req.get('X-Auth-Token');
  if (header) return header;

  return null;
}

export const AuthUser = createParamDecorator(
  async (_: unknown, ctx: ExecutionContext) => {
    const jwtService = new JwtService();
    const token = getAuthToken(ctx.switchToHttp().getRequest());
    if (!token) throw new UnauthorizedException();
    try {
      const payload = await jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      return payload;
    } catch {
      throw new UnauthorizedException();
    }
  },
);

export const KpiUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    
    // Return just the user ID instead of the entire token payload
    return user?.sub || user?.id;
  },
);
