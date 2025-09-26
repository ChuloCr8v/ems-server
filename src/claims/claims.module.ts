import { Module } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { ClaimsController } from './claims.controller';
import { UploadsModule } from '../uploads/uploads.module'; 

@Module({
  imports: [UploadsModule],
  providers: [ClaimsService],
  controllers: [ClaimsController]
})
export class ClaimsModule {}
