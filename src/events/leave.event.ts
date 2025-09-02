export interface LeaveRequestedPayload {
    employeeId: string;
    recipientIds: string[];
    leaveRequestId: string;
}

export interface LeaveApprovedPayload {
    employeeId: string;
    // recipientIds: string[];
    leaveRequestId: string;
    approverId: string;
}

export class LeaveRequestedEvent implements LeaveRequestedPayload {
    constructor(
        public readonly employeeId: string,
        public readonly recipientIds: string[],
        public readonly leaveRequestId: string,
    ) { }
}

export class LeaveApprovedEvent implements LeaveApprovedPayload {
    constructor(
        public readonly employeeId: string,
        // public readonly recipientIds: string[],
        public readonly leaveRequestId: string,
        public readonly approverId: string,
    ) {}
}  