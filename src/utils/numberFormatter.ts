export const formatNumberWithCommas = (number: number | undefined) => {
  let numberStr = String(number?.toFixed(0));
  let parts = [];
  while (numberStr.length > 3) {
    parts.unshift(numberStr.slice(-3));
    numberStr = numberStr.slice(0, -3);
  }
  parts.unshift(numberStr);

  let formattedNumber = parts.join(',');

  return formattedNumber;
};
// This function formats a number with commas as thousand separators
// Example usage:
// console.log(formatNumberWithCommas(1234567)); // Output: "1,234,567"
// console.log(formatNumberWithCommas(1234.56)); // Output: "1,235"export function formatNumberWithCommas(num: number): string {