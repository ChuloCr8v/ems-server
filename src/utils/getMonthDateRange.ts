export const getMonthDateRange = () => {
  const start = new Date();
  start.setDate(1); // Set to the first day of the month
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 1); // Set to the first day of the next month
  end.setDate(0); // Set to the last day of the current month
  end.setHours(23, 59, 59, 999);

  return { start, end };
};
// This function returns the start and end dates of the current month
// Example usage:
// const { start, end } = getMonthDateRange();
// console.log('Start of month:', start);
// console.log('End of month:', end);