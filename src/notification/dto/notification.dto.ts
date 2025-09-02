export interface NotificationDto {
    id?: string;
    recipientId: string;
    actorId?: string | null;
    prospectId?: string | null;
    type: string;
    message: string;
    createdAt?: Date;
}
