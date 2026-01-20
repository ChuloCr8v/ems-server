export class AppraisalCreatedEvent {
    constructor(
        public readonly appraisalId: string,
        public readonly employeeId: string,
        public readonly managerId: string,
        public readonly recipientIds: string[]
    ) { }
}

export class AppraisalSubmittedEvent {
    constructor(
        public readonly appraisalId: string,
        public readonly employeeId: string,
        public readonly managerId: string,
        public readonly recipientIds: string[]
    ) { }
}

export class AppraisalReviewedEvent {
    constructor(
        public readonly appraisalId: string,
        public readonly employeeId: string,
        public readonly managerId: string,
        public readonly recipientIds: string[]
    ) { }
}
