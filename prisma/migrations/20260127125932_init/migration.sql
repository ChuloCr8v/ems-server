-- CreateEnum
CREATE TYPE "public"."CommentType" AS ENUM ('REPLY', 'COMMENT');

-- CreateEnum
CREATE TYPE "public"."ApproverRole" AS ENUM ('DEPARTMENT_HEAD', 'DEPARTMENT_LEAD', 'HR', 'CISO');

-- CreateEnum
CREATE TYPE "public"."NotificationActionType" AS ENUM ('INVITE_ACCEPTED', 'EMPLOYEE_ADDED', 'LEAVE_REQUESTED', 'LEAVE_APPROVED', 'LEAVE_DECLINED', 'TASK_ASSIGNED', 'TASK_CREATED', 'CLAIM_CREATED', 'CLAIM_APPROVED', 'CLAIM_REJECTED', 'TASK_UPDATED', 'PAYSLIP_GENERATED', 'APPRAISAL_CREATED', 'APPRAISAL_REVIEWED', 'APPRAISAL_SUBMITTED');

-- CreateEnum
CREATE TYPE "public"."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('REJECTED', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED', 'CANCELLED', 'ISSUES');

-- CreateEnum
CREATE TYPE "public"."AStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'ISSUE_REPORTED', 'ACTIVE', 'INACTIVE', 'CONFIRMED', 'COMPLETED', 'IN_PROGRESS');

-- CreateEnum
CREATE TYPE "public"."TaxStatus" AS ENUM ('PENDING', 'CALCULATED', 'PAID');

-- CreateEnum
CREATE TYPE "public"."SalaryType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "public"."AppraisalStatus" AS ENUM ('GENERATED', 'PENDING', 'HR_REVIEW', 'DRAFT', 'MANAGER_DRAFT', 'SUBMITTED', 'APPRAISED', 'COMPLETED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "public"."KpiCategoryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."KpiCategoryType" AS ENUM ('ORGANIZATIONAL', 'DEPARTMENTAL', 'STATIC', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "public"."ComponentCategory" AS ENUM ('CUSTOM_EARNING', 'CUSTOM_DEDUCTION', 'STATIC_EARNING', 'STATIC_DEDUCTION');

-- CreateEnum
CREATE TYPE "public"."SalaryCalculationType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "public"."ResponseType" AS ENUM ('COMMENT', 'APPROVAL', 'DENIAL');

-- CreateEnum
CREATE TYPE "public"."JobType" AS ENUM ('FULL_TIME', 'CONTRACT');

-- CreateEnum
CREATE TYPE "public"."MaritalStatus" AS ENUM ('SINGLE', 'MARRIED');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'USER', 'DEPT_MANAGER', 'FACILITY', 'HR', 'ASSET_MANAGER', 'LEAVE_MANAGER', 'TEAM_LEAD');

-- CreateEnum
CREATE TYPE "public"."AssetCategory" AS ENUM ('HARDWARE', 'ACCESSORY', 'LOGISTICS', 'OFFICE_FURNITURE', 'SOFTWARE', 'SAFETY_EQUIPMENT', 'TELECOM', 'MEDICAL_EQUIPMENT', 'AUDIO_VISUAL', 'PAYMENT_DEVICE', 'GENERAL');

-- CreateEnum
CREATE TYPE "public"."AssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'REPORTED', 'FAULTY', 'RETIRED', 'ACCEPTED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "public"."AssignmentStatus" AS ENUM ('ASSIGNED', 'RETURNED');

-- CreateEnum
CREATE TYPE "public"."FaultStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ExitType" AS ENUM ('RESIGNATION', 'TERMINATION');

-- CreateEnum
CREATE TYPE "public"."LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."DepartmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."EntitlementUnit" AS ENUM ('AMOUNT', 'DAYS', 'OTHERS');

-- CreateEnum
CREATE TYPE "public"."ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "public"."CategoryType" AS ENUM ('Task', 'STATIC', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "public"."EntitlementType" AS ENUM ('CLAIMS', 'LEAVE');

-- CreateEnum
CREATE TYPE "public"."EntitlementScope" AS ENUM ('LEVEL', 'DEPARTMENT');

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "recipientId" UUID,
    "actorId" UUID,
    "prospectId" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "actionType" "public"."NotificationActionType",
    "actionData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "eId" TEXT,
    "personalEmail" TEXT,
    "email" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "workPhone" TEXT,
    "role" TEXT,
    "gender" TEXT NOT NULL,
    "duration" TEXT,
    "jobType" "public"."JobType",
    "country" TEXT,
    "state" TEXT,
    "address" TEXT,
    "startDate" TIMESTAMP(3),
    "status" "public"."Status" NOT NULL DEFAULT 'PENDING',
    "userRole" "public"."Role"[],
    "maritalStatus" "public"."MaritalStatus",
    "levelId" UUID,
    "prospectId" UUID,
    "dateOfBirth" TIMESTAMP(3),
    "defaultId" UUID,
    "teamId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" UUID,
    "status" "public"."DepartmentStatus" DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Team" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" UUID,
    "status" "public"."DepartmentStatus" DEFAULT 'ACTIVE',
    "departmentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Prospect" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "duration" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "jobType" "public"."JobType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invite" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "public"."Status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "sentById" UUID,
    "prospectId" UUID,
    "declineReasons" TEXT[],

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Level" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Upload" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "bytes" BYTEA,
    "key" TEXT,
    "order" INTEGER,
    "uri" TEXT,
    "prospectId" UUID,
    "userId" UUID,
    "offboardingId" UUID,
    "commentId" UUID,
    "handoverId" UUID,
    "paymentId" UUID,
    "assetId" UUID,
    "requestId" UUID,
    "publicId" TEXT,
    "secureUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "guarantorId" UUID,
    "claimId" TEXT,
    "taskId" UUID,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contacts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Bank" (
    "id" UUID NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NextOfKin" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "address" TEXT,

    CONSTRAINT "NextOfKin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmergencyContact" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "address" TEXT,
    "relationship" TEXT,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuarantorContact" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "address" TEXT,
    "relationship" TEXT,

    CONSTRAINT "GuarantorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Comment" (
    "id" UUID NOT NULL,
    "comment" TEXT NOT NULL,
    "userId" UUID,
    "inviteId" UUID,
    "offboardingId" UUID,
    "paymentId" UUID,
    "handoverId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "taskId" UUID,
    "claimId" TEXT,
    "leaveId" UUID,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Asset" (
    "id" UUID NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNo" TEXT,
    "category" "public"."AssetCategory",
    "purchaseDate" TIMESTAMP(3),
    "vendor" TEXT,
    "cost" DOUBLE PRECISION,
    "description" TEXT,
    "isReturned" BOOLEAN DEFAULT false,
    "status" "public"."AssetStatus" DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Assignment" (
    "id" TEXT NOT NULL,
    "assetId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "retrievedAt" TIMESTAMP(3),
    "notes" TEXT,
    "condition" TEXT,
    "status" "public"."AssignmentStatus",
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "offboardingId" UUID,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Fault" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "reportedById" UUID,
    "resolvedById" UUID,
    "images" TEXT[],
    "reason" TEXT,
    "notes" TEXT,
    "status" "public"."FaultStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Offboarding" (
    "id" UUID NOT NULL,
    "type" "public"."ExitType" NOT NULL,
    "lastWorkDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "noticePeriod" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."Status" NOT NULL DEFAULT 'PENDING',
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OffboardingChecklist" (
    "id" UUID NOT NULL,
    "task" TEXT NOT NULL,
    "status" "public"."Status" NOT NULL DEFAULT 'PENDING',
    "offboardingId" UUID NOT NULL,

    CONSTRAINT "OffboardingChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HandoverDocument" (
    "id" UUID NOT NULL,
    "offboardingId" UUID,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandoverDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" UUID NOT NULL,
    "offboardingId" UUID,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Entitlement" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "public"."EntitlementUnit" NOT NULL,
    "type" "public"."EntitlementType",
    "scope" "public"."EntitlementScope",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LevelEntitlement" (
    "id" UUID NOT NULL,
    "levelId" UUID NOT NULL,
    "entitlementId" UUID NOT NULL,
    "value" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DepartmentEntitlement" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "entitlementId" UUID NOT NULL,
    "value" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeaveRequest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "doaId" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "currentApprovalId" UUID,
    "reason" TEXT NOT NULL,
    "status" "public"."LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "typeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CancelRequest" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CancelRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Approver" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "departmentId" UUID,
    "role" "public"."Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teamId" UUID,

    CONSTRAINT "Approver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Approval" (
    "id" UUID NOT NULL,
    "leaveRequestId" UUID NOT NULL,
    "phase" INTEGER NOT NULL,
    "approverId" UUID,
    "status" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "actionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Response" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "public"."ResponseType" NOT NULL,
    "userId" UUID NOT NULL,
    "requestId" UUID,
    "note" TEXT NOT NULL,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payroll" (
    "id" UUID NOT NULL,
    "salary" DOUBLE PRECISION NOT NULL,
    "gross" DOUBLE PRECISION NOT NULL,
    "net" DOUBLE PRECISION NOT NULL,
    "deductions" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION,
    "cra" DOUBLE PRECISION,
    "taxableIncome" DOUBLE PRECISION,
    "pension" DOUBLE PRECISION,
    "nhf" DOUBLE PRECISION,
    "laa" DOUBLE PRECISION,
    "taxStatus" "public"."TaxStatus" NOT NULL DEFAULT 'PENDING',
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollComponent" (
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
    "payrollId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID,

    CONSTRAINT "PayrollComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payslip" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "payrollId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Deductions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "month" TEXT NOT NULL,
    "pension" INTEGER NOT NULL,
    "tax" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Claim" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dateOfExpense" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "status" "public"."ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "userId" UUID NOT NULL,
    "claimId" TEXT NOT NULL,
    "entitlementId" UUID,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaskIssues" (
    "id" UUID NOT NULL,
    "issue" TEXT NOT NULL,
    "taskId" UUID,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskIssues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExtensionRequests" (
    "id" UUID NOT NULL,
    "taskId" UUID,
    "requesterId" UUID,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" "public"."ClaimStatus" DEFAULT 'PENDING',
    "isVisible" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionRequests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Task" (
    "id" UUID NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "priority" TEXT,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "isReported" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,
    "departmentId" UUID,
    "teamId" UUID,
    "approvedById" UUID,
    "hasTransfer" BOOLEAN DEFAULT false,
    "approvalStatus" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvalRequestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "hasIssues" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."taskDueDate" (
    "id" UUID NOT NULL,
    "taskId" UUID,
    "dueDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taskDueDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaskTransfer" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "taskId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" UUID NOT NULL,
    "week" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" UUID NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "type" "public"."CategoryType",
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserTask" (
    "id" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,
    "taskId" UUID NOT NULL,

    CONSTRAINT "UserTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Appraisal" (
    "id" UUID NOT NULL,
    "quarter" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "managerComment" TEXT,
    "period" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "appraisedAt" TIMESTAMP(3),
    "hrReviewedAt" TIMESTAMP(3),
    "averageRating" DOUBLE PRECISION,
    "templateId" TEXT,
    "createdBy" TEXT,
    "autoGenerated" BOOLEAN NOT NULL DEFAULT true,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."AppraisalStatus" NOT NULL DEFAULT 'GENERATED',
    "departmentId" UUID NOT NULL,
    "appraiserId" UUID,
    "appraisedId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appraisal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Kpi" (
    "id" UUID NOT NULL,
    "appraisalId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KpiCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kpiId" UUID,
    "departmentId" UUID,
    "type" "public"."KpiCategoryType" NOT NULL DEFAULT 'ORGANIZATIONAL',
    "status" "public"."KpiCategoryStatus" NOT NULL DEFAULT 'PENDING',
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Objective" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "comment" TEXT,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppraisalObjective" (
    "id" UUID NOT NULL,
    "appraisalId" UUID NOT NULL,
    "objectiveId" UUID NOT NULL,
    "kpiCategoryId" UUID,
    "rating" DOUBLE PRECISION,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppraisalObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GoalsAndAchievement" (
    "id" UUID NOT NULL,
    "achievements" TEXT[],
    "goals" TEXT[],
    "appraisalId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalsAndAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Feedback" (
    "id" UUID NOT NULL,
    "appraisalId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeedbackQuestion" (
    "id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "response" TEXT,
    "feedbackId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RatingSummary" (
    "id" UUID NOT NULL,
    "averageRating" DOUBLE PRECISION NOT NULL,
    "appraisalId" UUID NOT NULL,
    "kpiCategoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatingSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_DepartmentToProspect" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_DepartmentToProspect_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_DepartmentToUser" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_DepartmentToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_ProspectDocuments" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ProspectDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_ReportToTask" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ReportToTask_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_CategoryToTask" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_CategoryToTask_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_CategoryToDepartment" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_CategoryToDepartment_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_eId_key" ON "public"."User"("eId");

-- CreateIndex
CREATE UNIQUE INDEX "User_personalEmail_key" ON "public"."User"("personalEmail");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_prospectId_key" ON "public"."User"("prospectId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_id_idx" ON "public"."User"("id");

-- CreateIndex
CREATE INDEX "User_eId_idx" ON "public"."User"("eId");

-- CreateIndex
CREATE INDEX "User_firstName_lastName_idx" ON "public"."User"("firstName", "lastName");

-- CreateIndex
CREATE INDEX "User_levelId_idx" ON "public"."User"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "public"."Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_createdById_key" ON "public"."Department"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "public"."Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_email_key" ON "public"."Prospect"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "public"."Invite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_publicId_key" ON "public"."Upload"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_secureUrl_key" ON "public"."Upload"("secureUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Contacts_userId_key" ON "public"."Contacts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_userId_key" ON "public"."Bank"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetId_key" ON "public"."Asset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_serialNo_key" ON "public"."Asset"("serialNo");

-- CreateIndex
CREATE INDEX "Fault_reportedById_idx" ON "public"."Fault"("reportedById");

-- CreateIndex
CREATE INDEX "Fault_resolvedById_idx" ON "public"."Fault"("resolvedById");

-- CreateIndex
CREATE INDEX "Fault_assetId_idx" ON "public"."Fault"("assetId");

-- CreateIndex
CREATE INDEX "Fault_status_idx" ON "public"."Fault"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Offboarding_userId_key" ON "public"."Offboarding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_name_key" ON "public"."Entitlement"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LevelEntitlement_levelId_entitlementId_key" ON "public"."LevelEntitlement"("levelId", "entitlementId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentEntitlement_departmentId_entitlementId_key" ON "public"."DepartmentEntitlement"("departmentId", "entitlementId");

-- CreateIndex
CREATE UNIQUE INDEX "CancelRequest_requestId_key" ON "public"."CancelRequest"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_leaveRequestId_phase_key" ON "public"."Approval"("leaveRequestId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_userId_key" ON "public"."Payroll"("userId");

-- CreateIndex
CREATE INDEX "Payslip_userId_idx" ON "public"."Payslip"("userId");

-- CreateIndex
CREATE INDEX "Payslip_payrollId_idx" ON "public"."Payslip"("payrollId");

-- CreateIndex
CREATE INDEX "Payslip_month_year_idx" ON "public"."Payslip"("month", "year");

-- CreateIndex
CREATE INDEX "Deductions_id_month_idx" ON "public"."Deductions"("id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_claimId_key" ON "public"."Claim"("claimId");

-- CreateIndex
CREATE INDEX "Claim_id_idx" ON "public"."Claim"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Task_taskId_key" ON "public"."Task"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_categoryId_key" ON "public"."Category"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_title_key" ON "public"."Category"("title");

-- CreateIndex
CREATE UNIQUE INDEX "UserTask_userId_taskId_key" ON "public"."UserTask"("userId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Appraisal_quarter_year_appraisedId_key" ON "public"."Appraisal"("quarter", "year", "appraisedId");

-- CreateIndex
CREATE UNIQUE INDEX "Kpi_appraisalId_key" ON "public"."Kpi"("appraisalId");

-- CreateIndex
CREATE UNIQUE INDEX "KpiCategory_name_departmentId_key" ON "public"."KpiCategory"("name", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalsAndAchievement_appraisalId_key" ON "public"."GoalsAndAchievement"("appraisalId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_appraisalId_key" ON "public"."Feedback"("appraisalId");

-- CreateIndex
CREATE UNIQUE INDEX "RatingSummary_appraisalId_key" ON "public"."RatingSummary"("appraisalId");

-- CreateIndex
CREATE INDEX "_DepartmentToProspect_B_index" ON "public"."_DepartmentToProspect"("B");

-- CreateIndex
CREATE INDEX "_DepartmentToUser_B_index" ON "public"."_DepartmentToUser"("B");

-- CreateIndex
CREATE INDEX "_ProspectDocuments_B_index" ON "public"."_ProspectDocuments"("B");

-- CreateIndex
CREATE INDEX "_ReportToTask_B_index" ON "public"."_ReportToTask"("B");

-- CreateIndex
CREATE INDEX "_CategoryToTask_B_index" ON "public"."_CategoryToTask"("B");

-- CreateIndex
CREATE INDEX "_CategoryToDepartment_B_index" ON "public"."_CategoryToDepartment"("B");

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "public"."Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_defaultId_fkey" FOREIGN KEY ("defaultId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "public"."Level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "public"."Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Department" ADD CONSTRAINT "Department_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invite" ADD CONSTRAINT "Invite_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "public"."Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invite" ADD CONSTRAINT "Invite_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "public"."Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_guarantorId_fkey" FOREIGN KEY ("guarantorId") REFERENCES "public"."GuarantorContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "public"."HandoverDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_offboardingId_fkey" FOREIGN KEY ("offboardingId") REFERENCES "public"."Offboarding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "public"."Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contacts" ADD CONSTRAINT "Contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Bank" ADD CONSTRAINT "Bank_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NextOfKin" ADD CONSTRAINT "NextOfKin_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmergencyContact" ADD CONSTRAINT "EmergencyContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuarantorContact" ADD CONSTRAINT "GuarantorContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "public"."HandoverDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "public"."Invite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_offboardingId_fkey" FOREIGN KEY ("offboardingId") REFERENCES "public"."Offboarding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "public"."Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "public"."LeaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_offboardingId_fkey" FOREIGN KEY ("offboardingId") REFERENCES "public"."Offboarding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Fault" ADD CONSTRAINT "Fault_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Fault" ADD CONSTRAINT "Fault_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Fault" ADD CONSTRAINT "Fault_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Offboarding" ADD CONSTRAINT "Offboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffboardingChecklist" ADD CONSTRAINT "OffboardingChecklist_offboardingId_fkey" FOREIGN KEY ("offboardingId") REFERENCES "public"."Offboarding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HandoverDocument" ADD CONSTRAINT "HandoverDocument_offboardingId_fkey" FOREIGN KEY ("offboardingId") REFERENCES "public"."Offboarding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_offboardingId_fkey" FOREIGN KEY ("offboardingId") REFERENCES "public"."Offboarding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LevelEntitlement" ADD CONSTRAINT "LevelEntitlement_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "public"."Entitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LevelEntitlement" ADD CONSTRAINT "LevelEntitlement_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "public"."Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentEntitlement" ADD CONSTRAINT "DepartmentEntitlement_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "public"."Entitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentEntitlement" ADD CONSTRAINT "DepartmentEntitlement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaveRequest" ADD CONSTRAINT "LeaveRequest_doaId_fkey" FOREIGN KEY ("doaId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaveRequest" ADD CONSTRAINT "LeaveRequest_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."Entitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CancelRequest" ADD CONSTRAINT "CancelRequest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Approver" ADD CONSTRAINT "Approver_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Approver" ADD CONSTRAINT "Approver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Approver" ADD CONSTRAINT "Approver_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Approval" ADD CONSTRAINT "Approval_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "public"."LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Response" ADD CONSTRAINT "Response_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Response" ADD CONSTRAINT "Response_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payroll" ADD CONSTRAINT "Payroll_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollComponent" ADD CONSTRAINT "PayrollComponent_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "public"."Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollComponent" ADD CONSTRAINT "PayrollComponent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payslip" ADD CONSTRAINT "Payslip_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "public"."Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payslip" ADD CONSTRAINT "Payslip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Claim" ADD CONSTRAINT "Claim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Claim" ADD CONSTRAINT "Claim_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "public"."Entitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskIssues" ADD CONSTRAINT "TaskIssues_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskIssues" ADD CONSTRAINT "TaskIssues_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExtensionRequests" ADD CONSTRAINT "ExtensionRequests_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExtensionRequests" ADD CONSTRAINT "ExtensionRequests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."taskDueDate" ADD CONSTRAINT "taskDueDate_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskTransfer" ADD CONSTRAINT "TaskTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskTransfer" ADD CONSTRAINT "TaskTransfer_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserTask" ADD CONSTRAINT "UserTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserTask" ADD CONSTRAINT "UserTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appraisal" ADD CONSTRAINT "Appraisal_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appraisal" ADD CONSTRAINT "Appraisal_appraiserId_fkey" FOREIGN KEY ("appraiserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appraisal" ADD CONSTRAINT "Appraisal_appraisedId_fkey" FOREIGN KEY ("appraisedId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Kpi" ADD CONSTRAINT "Kpi_appraisalId_fkey" FOREIGN KEY ("appraisalId") REFERENCES "public"."Appraisal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KpiCategory" ADD CONSTRAINT "KpiCategory_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "public"."Kpi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KpiCategory" ADD CONSTRAINT "KpiCategory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Objective" ADD CONSTRAINT "Objective_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."KpiCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppraisalObjective" ADD CONSTRAINT "AppraisalObjective_appraisalId_fkey" FOREIGN KEY ("appraisalId") REFERENCES "public"."Appraisal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppraisalObjective" ADD CONSTRAINT "AppraisalObjective_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "public"."Objective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppraisalObjective" ADD CONSTRAINT "AppraisalObjective_kpiCategoryId_fkey" FOREIGN KEY ("kpiCategoryId") REFERENCES "public"."KpiCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GoalsAndAchievement" ADD CONSTRAINT "GoalsAndAchievement_appraisalId_fkey" FOREIGN KEY ("appraisalId") REFERENCES "public"."Appraisal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_appraisalId_fkey" FOREIGN KEY ("appraisalId") REFERENCES "public"."Appraisal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedbackQuestion" ADD CONSTRAINT "FeedbackQuestion_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "public"."Feedback"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RatingSummary" ADD CONSTRAINT "RatingSummary_appraisalId_fkey" FOREIGN KEY ("appraisalId") REFERENCES "public"."Appraisal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RatingSummary" ADD CONSTRAINT "RatingSummary_kpiCategoryId_fkey" FOREIGN KEY ("kpiCategoryId") REFERENCES "public"."KpiCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_DepartmentToProspect" ADD CONSTRAINT "_DepartmentToProspect_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_DepartmentToProspect" ADD CONSTRAINT "_DepartmentToProspect_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_DepartmentToUser" ADD CONSTRAINT "_DepartmentToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_DepartmentToUser" ADD CONSTRAINT "_DepartmentToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProspectDocuments" ADD CONSTRAINT "_ProspectDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProspectDocuments" ADD CONSTRAINT "_ProspectDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ReportToTask" ADD CONSTRAINT "_ReportToTask_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ReportToTask" ADD CONSTRAINT "_ReportToTask_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToTask" ADD CONSTRAINT "_CategoryToTask_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToTask" ADD CONSTRAINT "_CategoryToTask_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToDepartment" ADD CONSTRAINT "_CategoryToDepartment_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToDepartment" ADD CONSTRAINT "_CategoryToDepartment_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
