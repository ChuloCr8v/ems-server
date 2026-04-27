export class ReportSubmittedEvent {
  constructor(
    public readonly reportId: string,
    public readonly submittedById: string,
    public readonly reportTitle: string,
    public readonly week: number,
    public readonly departmentName: string,
  ) {}
}
