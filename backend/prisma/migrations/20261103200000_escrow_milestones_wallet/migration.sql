-- Mərhələ 2A: escrow, mərhələlər (sprint), pul kisəsi və dəyişməz maliyyə jurnalı (ledger).
-- Yalnız yeni cədvəllər/tiplər və Issue-a nullable sütun əlavə olunur: mövcud məlumat dəyişmir və silinmir.
-- Məbləğlər USD sentlə INTEGER-dir. Maliyyə yazılarına FK-lar ON DELETE RESTRICT-dir (kaskadla silinmir).

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'FUNDED', 'IN_REVIEW', 'APPROVED', 'PAID', 'DISPUTED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('TOP_UP', 'MILESTONE_FUNDING', 'ESCROW_LOCK', 'ESCROW_RELEASE', 'MILESTONE_PAYMENT', 'COMMISSION', 'REFUND', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "WalletBalanceType" AS ENUM ('AVAILABLE', 'LOCKED');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('CREDIT', 'DEBIT');

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "milestoneId" TEXT;

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "fundedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableCents" INTEGER NOT NULL DEFAULT 0,
    "lockedCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "type" "TransactionType" NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "balanceType" "WalletBalanceType" NOT NULL DEFAULT 'AVAILABLE',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Milestone_contractId_status_idx" ON "Milestone"("contractId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_contractId_sequence_key" ON "Milestone"("contractId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Transaction_walletId_createdAt_idx" ON "Transaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_milestoneId_idx" ON "Transaction"("milestoneId");

-- CreateIndex
CREATE INDEX "Transaction_reference_idx" ON "Transaction"("reference");

-- CreateIndex
CREATE INDEX "Issue_milestoneId_idx" ON "Issue"("milestoneId");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Məlumat bütövlüyü (Prisma sxemində ifadə olunmur, ona görə SQL ilə)
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_amountCents_positive" CHECK ("amountCents" > 0);
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_sequence_positive" CHECK ("sequence" >= 1);
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_availableCents_non_negative" CHECK ("availableCents" >= 0);
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_lockedCents_non_negative" CHECK ("lockedCents" >= 0);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amountCents_positive" CHECK ("amountCents" > 0);
