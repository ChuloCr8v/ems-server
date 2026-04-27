export class TaskAssignedEvent {
  constructor(
    public readonly actorId: string,
    public readonly recipientIds: string[],
    public readonly requestId: string,
  ) {}
}

export class TaskUpdatedEvent {
  constructor(
    public readonly actorId: string,
    public readonly recipientIds: string[],
    public readonly taskId: string,
    public readonly taskTitle: string,
    public readonly newStatus: string,
  ) {}
}

export class TaskCreatedEvent {
  constructor(
    public readonly actorId: string,
    public readonly recipientIds: string[],
    public readonly taskId: string,
    public readonly taskTitle: string,
  ) {}
}
