import { Body, Controller, Post, Get } from '@nestjs/common';
import { LeadershipService } from './leadership.service';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { createLeadershipAssessmentItemDto } from './leadership.dto';

@Controller('leadership')
export class LeadershipController {
    constructor(private leadership: LeadershipService) { }

    @Post("")
    @Auth(["ADMIN", "HR", "SUPERADMIN"])
    async createLeadershipAssessmentItem(@Body() body: createLeadershipAssessmentItemDto) {
        return this.leadership.createLeadershipAssessmentItem(body)
    }


    @Get("")
    @Auth(["ADMIN", "HR", "SUPERADMIN"])
    async listLeadershipAssementItems() {
        return this.leadership.listLeadershipAssessmentItem()
    }
}
