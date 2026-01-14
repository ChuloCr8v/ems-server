
export class PayslipGeneratedEvent {
    constructor(
        public readonly userId: string,
        public readonly payrollId: string,
        public readonly month: string,
        public readonly year: number,
        public readonly link?: string,
    ) { }
}
