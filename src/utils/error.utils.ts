import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

type Err = 400 | 401 | 403 | 404 | 409 | 500;

export function bad(message: string, err: Err = 400): never {
  console.log(message)
  switch (err) {
    case 401: throw new UnauthorizedException(message);
    case 403: throw new ForbiddenException(message);
    case 404: throw new NotFoundException(message);
    case 409: throw new ConflictException(message);
    case 500: throw new InternalServerErrorException(message);
    default: throw new BadRequestException(message);
  }
}

export function mustHave(
  value: unknown,
  message: string,
  err: Err = 400,
): asserts value {
  if (!value) bad(message, err);
}
