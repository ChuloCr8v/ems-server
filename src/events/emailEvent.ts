
export class SendEmailEvent {
  constructor(
    public readonly recipients: string[],
    public readonly subject: string,
    public readonly message: string,
  ) { }
}

