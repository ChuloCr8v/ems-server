import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactService } from './contacts.service';

@Module({
  controllers: [ContactsController],
  providers: [ContactService]
})
export class ContactsModule { }
