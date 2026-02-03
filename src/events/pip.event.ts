export class PipRecommendedEvent {
  constructor(
    public rPipId: string,
    public recommenderId: string,
    public employeeId: string,
    public recipientIds: string[],
  ) {}
}

export class PipApprovedEvent {
  constructor(
    public pipId: string,
    public approverId: string,
    public employeeId: string,
    public recipientIds: string[],
  ) {}
}

export class PipRejectedEvent {
  constructor(
    public pipId: string, // or rPipId depending on context, but rejectPip uses pipId
    public rejectorId: string,
    public employeeId: string,
    public recipientIds: string[],
  ) {}
}

export class PipCompletedEvent {
  constructor(
    public pipId: string,
    public employeeId: string,
    public recipientIds: string[],
  ) {}
}
