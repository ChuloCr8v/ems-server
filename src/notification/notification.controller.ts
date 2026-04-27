// notification.controller.ts
import { Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get(':id')
  async getNotifications(@Param('id') id: string) {
    return this.notificationService.getForUser(id);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationService.markAsRead(id);
  }

  @Patch('read-all/:id')
  async markAllAsRead(@Param('id') id: string) {
    return this.notificationService.markAllAsRead(id);
  }
}
