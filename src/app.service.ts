import { HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor() {}
  getHello() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Hello World! Welcome to Employee Management System API',
    };
  }
}
