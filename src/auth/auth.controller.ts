// import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
// import { AuthService } from './auth.service';
// import { AzureAuthDto } from './dto/auth.dto';

// @Controller('auth')
// export class AuthController {
//   constructor(private readonly authService: AuthService) {}

//   @Post('azure')
//   @UsePipes(new ValidationPipe({ whitelist: true }))
//   async azureLogin(@Body() dto: AzureAuthDto) {
//     return this.authService.azureLogin(dto);
//   }
// }

import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('azure')
  async azureLogin(@Body() body: any) {
    return this.authService.azureLogin(body);
  }
}
