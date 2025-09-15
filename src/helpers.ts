export function countBusinessDays(startDate: Date, endDate: Date): number {
    let days = 0;
    let current = new Date(startDate);
    while (current <= endDate) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) days++;
        current.setDate(current.getDate() + 1);
    }
    return days;
}
