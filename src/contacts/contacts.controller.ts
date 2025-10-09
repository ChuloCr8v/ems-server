import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
} from "@nestjs/common";
import { ContactDto } from "./contacts.dto";
import { ContactService } from "./contacts.service";

@Controller("contacts")
export class ContactsController {
    constructor(private readonly contact: ContactService) { }

    @Post(":userId")
    async create(
        @Param("userId") userId: string,
        @Body() body: { context: "EMERGENCY" | "KIN" | "GUARANTOR"; data: ContactDto[] },
    ) {
        const { data, context } = body;
        return this.contact.create(userId, data, context);
    }

    @Put(":id")
    async update(
        @Param("id") id: string,
        @Body() body: { context: "EMERGENCY" | "KIN" | "GUARANTOR"; data: ContactDto },
    ) {
        const { data, context } = body;
        return this.contact.update(id, data, context);
    }

    @Delete(":id/:context")
    async delete(
        @Param("id") id: string,
        @Param("context") context: "EMERGENCY" | "KIN" | "GUARANTOR",
    ) {
        return this.contact.delete(id, context);
    }

    @Get(":userId/:context")
    async list(
        @Param("userId") userId: string,
        @Param("context") context: "EMERGENCY" | "KIN" | "GUARANTOR",
    ) {
        return this.contact.list(userId, context);
    }

    @Get(":userId/:context/:id")
    async getOne(
        @Param("userId") userId: string,
        @Param("id") id: string,
        @Param("context") context: "EMERGENCY" | "KIN" | "GUARANTOR",
    ) {
        return this.contact.getOne(userId, id, context);
    }
}
