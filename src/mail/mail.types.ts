import { IsEmail, IsString } from "class-validator"

export const MAIL_SUBJECT = {
    PROSPECT_INVITATION: 'Prospect Invitation',
    OFFER_ACCEPTANCE: 'Offer Acceptance',
    UPDATE_USER_INFO: 'Update User Information',
    DECLINE_OFFER: 'Declined Offer',
}

export class ProspectInviteDto {

    @IsEmail()
    email: string

    @IsString()
    firstName: string;

    @IsString()
    token: string;

    attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
    encoding?: string;
    cid?: string; // For embedded images
    path?: string; // If using file paths instead of buffers
  }>;
}


export class AcceptanceInviteDto {
    @IsEmail()
    email: string;

    @IsString()
    name: string;

    @IsString()
    link: string;
}


export class DeclinedInviteDto extends AcceptanceInviteDto {}


export class UpdateProspectInfoDto {
    @IsEmail()
    email: string;

    @IsString()
    name: string;

    @IsString()
    comment: string;

    @IsString()
    link: string;
}

