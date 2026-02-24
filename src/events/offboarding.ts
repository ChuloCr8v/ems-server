export class OffboardingInitatedEvent {
  constructor(
    public employeeId: string,
    public offboardingId: string,
    public recipientId: string[]
  ) {}
}