export interface EmploymentAcceptedPayload {
    employeeId: string;
    recipientIds: string[];
}

export class EmploymentAcceptedEvent implements EmploymentAcceptedPayload {
    constructor(
        public readonly employeeId: string,
        public readonly recipientIds: string[],
    ) { }
}

export class EmploymentApprovedEvent implements EmploymentAcceptedPayload {
    constructor(
        public readonly employeeId: string,
        public readonly recipientIds: string[],
    ) { }
}
