import { Body, Controller, Post } from '@nestjs/common';
import { SendEmailDto } from './email.dto';
import { EmailsService } from './emails.service';
import { Auth } from 'src/auth/decorators/auth.decorator';

@Controller('emails')
export class EmailsController {
  constructor(private readonly emailService: EmailsService) {}
  @Post('send')
  @Auth(['ADMIN', 'SUPERADMIN', 'HR'])
  async sendEmail(@Body() body: SendEmailDto) {
    return this.emailService.sendEmail(body);
  }

  // @Get('all')
  // @Auth(["ADMIN", "SUPERADMIN", "HR"])
  // async getAllEmails() {
  //     return this.emailService.getAllEmails();
  // }
}
