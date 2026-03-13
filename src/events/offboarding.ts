export class OffboardingInitatedEvent {
  constructor(
    public employeeId: string,
    public offboardingId: string,
    public recipientId: string[],
  ) {}
}

export class TaskHandoverSignatureRequestedEvent {
  constructor(
    public assignerId: string, // the offboarding employee
    public assigneeId: string, // the new employee taking the task
    public taskId: string,
    public offboardingId: string
  ) {}
}