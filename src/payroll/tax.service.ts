import { Injectable } from "@nestjs/common";
import { TAX_BANDS_2025, TAX_CONFIG } from "src/constants/tax.constants";

@Injectable()
export class TaxService {
    calculateTaxableIncome(gross: number, pension: number, nhf: number): number {
        //Calculate consolidated relief allowance (CRA)
        const cra = Math.max(
            TAX_CONFIG.CRA_MINIMUM,
            TAX_CONFIG.CRA_PERCENTAGE * gross + TAX_CONFIG.CRA_ADDITIONAL * gross
        );

        console.log(cra)


        //Calculate taxable income: Gross - CRA - Pension - NHF
        return Math.max(0, gross - cra - pension - nhf);
    }

    calculateProgressiveTax(taxableIncome: number): number {
        let remainingIncome = taxableIncome;
        let totalTax = 0;

        for (const band of TAX_BANDS_2025) {
            if (remainingIncome <= 0) break;

            const bandAmount = Math.min(remainingIncome, band.threshold);
            totalTax += bandAmount * band.rate;
            remainingIncome -= bandAmount;
        }
        return totalTax;
    }

    calculatePension(basic: number, housing: number, transport: number): number {
        return (basic + housing + transport) * TAX_CONFIG.PENSION_RATE;
    }

    calculateNHF(salary: number): number {
        return salary * TAX_CONFIG.NHF_RATE;
    }

    calculateLAAPremium(annualAmount: number): number {
        //Life assurance premium is deductable up to 20% of total income
        return Math.min(annualAmount, TAX_CONFIG.LIFE_ASSURANCE_LIMIT);
    }

    calculateTotalTax(
        gross: number,
        basic: number,
        housing: number,
        transport: number,
        laPreminum?: number
    ): {
        taxableIncome: number,
        tax: number;
        cra: number;
        pension: number;
        nhf: number;
        laa: number;
    } {
        //Calculate pension (8% of basic + housing + transport)
        const pension = this.calculatePension(basic, housing, transport);

        //Calculate NHF(2.5% of basic salary)
        const nhf = this.calculateNHF(basic);

        //Calculate life assurance (if provided)
        const laa = laPreminum
            ? this.calculateLAAPremium(laPreminum)
            : 0;

        //Calculate taxable income
        const taxableIncome = this.calculateTaxableIncome(
            gross,
            pension,
            nhf + laa
        );

        //Calculate tax using progressive bands
        const tax = this.calculateProgressiveTax(taxableIncome);

        //Calculate CRA
        const cra = Math.max(
            TAX_CONFIG.CRA_MINIMUM,
            TAX_CONFIG.CRA_PERCENTAGE * gross + TAX_CONFIG.CRA_ADDITIONAL * gross
        );

        return {
            taxableIncome,
            tax,
            pension,
            cra,
            nhf,
            laa,
        };
    }
}