export const TAX_BANDS_2025 = [
  { threshold: 300000, rate: 0.07 },   // First 300,000 at 7%
  { threshold: 300000, rate: 0.11 },   // Next 300,000 at 11%
  { threshold: 500000, rate: 0.15 },   // Next 500,000 at 15%
  { threshold: 500000, rate: 0.19 },   // Next 500,000 at 19%
  { threshold: 1600000, rate: 0.21 },  // Next 1,600,000 at 21%
  { threshold: Infinity, rate: 0.24 }, // Above 3,200,000 at 24%
];

export const TAX_CONFIG = {
  CRA_PERCENTAGE: 0.01, // 1% of gross income
  CRA_MINIMUM: 200000,  // Minimum of ₦200,000
  CRA_ADDITIONAL: 0.20, // 20% of gross income
  PENSION_RATE: 0.08,   // 8% of basic, housing, and transport
  NHF_RATE: 0.025,      // 2.5% of basic salary
  LIFE_ASSURANCE_LIMIT: 0.20, // 20% of total income (deductible limit)
};