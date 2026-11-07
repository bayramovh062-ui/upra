-- P2: revision limiti + təhvil tarixçəsi, milestone mübahisəsi, ADMIN rolu, şikayətlər.
-- Yalnız yeni sütun/cədvəl/tip əlavə edilir; mövcud məlumat dəyişmir.

-- Enum: Role
ALTER TYPE "Role" ADD VALUE 'ADMIN';

-- Enum-lar
CREATE TYPE "SubmissionType" AS ENUM ('SUBMITTED', 'CHANGES_REQUESTED');
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "DisputeResolution" AS ENUM ('RELEASE', 'REFUND', 'SPLIT');
CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'CONTRACT', 'MILESTONE', 'JOB', 'MESSAGE');
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'CLOSED');

-- Milestone: revision limiti və dispute nəticəsi
ALTER TABLE "Milestone" ADD COLUMN "maxRevisions" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Milestone" ADD COLUMN "revisionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Milestone" ADD COLUMN "resolvedReleaseCents" INTEGER;
ALTER TABLE "Milestone" ADD COLUMN "resolvedRefundCents" INTEGER;

-- MilestoneSubmission
CREATE TABLE "MilestoneSubmission" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" "SubmissionType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MilestoneSubmission_milestoneId_createdAt_idx" ON "MilestoneSubmission"("milestoneId", "createdAt");
CREATE INDEX "MilestoneSubmission_contractId_createdAt_idx" ON "MilestoneSubmission"("contractId", "createdAt");

ALTER TABLE "MilestoneSubmission" ADD CONSTRAINT "MilestoneSubmission_milestoneId_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MilestoneSubmission" ADD CONSTRAINT "MilestoneSubmission_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MilestoneSubmission" ADD CONSTRAINT "MilestoneSubmission_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Dispute
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" "DisputeResolution",
    "releaseToFreelancerCents" INTEGER,
    "refundToClientCents" INTEGER,
    "adminId" TEXT,
    "adminNote" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");
CREATE INDEX "Dispute_milestoneId_status_idx" ON "Dispute"("milestoneId", "status");
CREATE INDEX "Dispute_contractId_idx" ON "Dispute"("contractId");

-- Bir mərhələdə eyni anda yalnız bir OPEN dispute (Prisma sxemində ifadə olunmur, DB-də qorunur)
CREATE UNIQUE INDEX "Dispute_milestoneId_open_key" ON "Dispute"("milestoneId") WHERE "status" = 'OPEN';

ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_milestoneId_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey"
    FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Report
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "adminId" TEXT,
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
