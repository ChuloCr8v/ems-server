export class ClaimCreatedEvent {
  constructor(
    public readonly claimId: string,
    public readonly employeeId: string,
    public readonly recipientIds: string[],
  ) {}
}

export class ClaimApprovedEvent {
  constructor(
    public readonly claimId: string,
    public readonly employeeId: string,
    public readonly recipientIds: string[],
    public readonly approverId: string,
  ) {}
}

export class ClaimRejectedEvent {
  constructor(
    public readonly claimId: string,
    public readonly employeeId: string,
    public readonly recipientIds: string[],
    public readonly approverId: string,
    public readonly reason?: string,
  ) {}
}

export class ClaimPaidEvent {
  constructor(
    public readonly claimId: string,
    public readonly userId: string,
    public readonly recipients: string[],
    public readonly paymentReference: string,
    public readonly amount: number,
  ) {}
}

