/*
  Warnings:

  - A unique constraint covering the columns `[payrollId,month,year]` on the table `Payslip` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."PipStatus" AS ENUM ('PENDING', 'MANAGER_APPROVED', 'HR_APPROVED', 'REJECTED', 'COMPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."NotificationActionType" ADD VALUE 'PIP_RECOMMENDED';
ALTER TYPE "public"."NotificationActionType" ADD VALUE 'PIP_APPROVED';
ALTER TYPE "public"."NotificationActionType" ADD VALUE 'PIP_REJECTED';
ALTER TYPE "public"."NotificationActionType" ADD VALUE 'PIP_COMPLETED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."Status" ADD VALUE 'APPROVED';
ALTER TYPE "public"."Status" ADD VALUE 'REJECTED';

-- DropForeignKey
ALTER TABLE "public"."Approver" DROP CONSTRAINT "Approver_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Payroll" DROP CONSTRAINT "Payroll_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_defaultId_fkey";

-- DropIndex
DROP INDEX "public"."Deductions_id_month_idx";

-- DropIndex
DROP INDEX "public"."Payslip_month_year_idx";

-- DropIndex
DROP INDEX "public"."Payslip_payrollId_idx";

-- AlterTable
ALTER TABLE "public"."Comment" ADD COLUMN     "pipId" UUID,
ADD COLUMN     "rPipId" UUID;

-- AlterTable
ALTER TABLE "public"."Deductions" ALTER COLUMN "pension" SET DATA TYPE DECIMAL(15,2),
ALTER COLUMN "tax" SET DATA TYPE DECIMAL(15,2);

-- AlterTable
ALTER TABLE "public"."Payslip" ADD COLUMN     "deductions" DOUBLE PRECISION,
ADD COLUMN     "earnings" DOUBLE PRECISION,
ADD COLUMN     "gross" DOUBLE PRECISION,
ADD COLUMN     "net" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."Upload" ADD COLUMN     "pipId" UUID,
ADD COLUMN     "recomPipId" UUID;

-- CreateTable
CREATE TABLE "public"."PayslipComponent" (
    "id" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "public"."SalaryType" NOT NULL,
    "title" TEXT NOT NULL,
    "calculations" "public"."SalaryCalculationType" NOT NULL,
    "category" "public"."ComponentCategory" NOT NULL,
    "monthlyAmount" DOUBLE PRECISION NOT NULL,
    "annualAmount" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER,
    "startDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "payslipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID,

    CONSTRAINT "PayslipComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Pip" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "duration" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "public"."PipStatus" NOT NULL DEFAULT 'PENDING',
    "rPipId" UUID,
    "userId" UUID NOT NULL,
    "rejectedById" UUID,
    "rejecteAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecommendedPip" (
    "id" UUID NOT NULL,
    "rPipId" TEXT NOT NULL,
    "aoi" TEXT NOT NULL,
    "recommendedById" UUID NOT NULL,
    "recommendedForId" UUID NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendedPip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pip_rPipId_key" ON "public"."Pip"("rPipId");

-- CreateIndex
CREATE INDEX "Deductions_month_idx" ON "public"."Deductions"("month");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_payrollId_month_year_key" ON "public"."Payslip"("payrollId", "month", "year");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_defaultId_fkey" FOREIGN KEY ("defaultId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_pipId_fkey" FOREIGN KEY ("pipId") REFERENCES "public"."Pip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_recomPipId_fkey" FOREIGN KEY ("recomPipId") REFERENCES "public"."RecommendedPip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_pipId_fkey" FOREIGN KEY ("pipId") REFERENCES "public"."Pip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_rPipId_fkey" FOREIGN KEY ("rPipId") REFERENCES "public"."RecommendedPip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Approver" ADD CONSTRAINT "Approver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payroll" ADD CONSTRAINT "Payroll_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayslipComponent" ADD CONSTRAINT "PayslipComponent_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "public"."Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pip" ADD CONSTRAINT "Pip_rPipId_fkey" FOREIGN KEY ("rPipId") REFERENCES "public"."RecommendedPip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pip" ADD CONSTRAINT "Pip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecommendedPip" ADD CONSTRAINT "RecommendedPip_recommendedById_fkey" FOREIGN KEY ("recommendedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecommendedPip" ADD CONSTRAINT "RecommendedPip_recommendedForId_fkey" FOREIGN KEY ("recommendedForId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
