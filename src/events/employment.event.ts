import { ProspectInviteDto } from "src/mail/mail.types";

export class EmploymentAcceptedEvent {
  constructor(
    public readonly employeeId: string,
    public readonly recipientIds: string[],
  ) { }
}

export class EmploymentApprovedEvent {
  constructor(
    public readonly employeeId: string,
    public readonly recipientIds: string[],
  ) { }
}
export class InviteDocumentsSubmittedEvent {
  constructor(
    public readonly employeeId: string,
    public readonly recipientIds: string[],
  ) { }
}
export class InviteSentEvent {
  constructor(
    public readonly prospectId: string,
    public readonly token: string,
    public readonly attachments: ProspectInviteDto["attachments"],
  ) { }
}
