import { Controller, Post, Body, Request, Get, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Auth, AuthUser } from './decorators/auth.decorator';
import { IAuthUser } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('azure')
  async azureLogin(@Body() body: any) {
    return this.authService.azureLogin(body);
  }

  @Post('login')
  async emailLogin(@Body() body: { email: string, password: string }) {
    return this.authService.emailLogin(body.email, body.password);
  }

  @Auth()
  @Get('user')
  async getAuthUser(@AuthUser() user: IAuthUser) {
    return this.authService.authUser(user);
  }


  @Get('token/:id')
  async generateProspectAccessToken(@Param("id") id: string) {
    return this.authService.generateProspectAccessToken(id);
  }

}
