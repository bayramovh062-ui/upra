-- P3: müqavilə rəyləri/reputasiya + admin istifadəçi moderasiyası (suspension).
-- Yalnız yeni cədvəl/sütun/indeks əlavə edilir; mövcud məlumat dəyişmir.
-- P2 partial unique index (Dispute_milestoneId_open_key) toxunulmur.

-- User: admin moderasiyası (soft suspension). suspendedByAdminId özünə FK-dır.
ALTER TABLE "User" ADD COLUMN "isSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "suspensionReason" TEXT;
ALTER TABLE "User" ADD COLUMN "suspendedByAdminId" TEXT;

CREATE INDEX "User_suspendedByAdminId_idx" ON "User"("suspendedByAdminId");

ALTER TABLE "User" ADD CONSTRAINT "User_suspendedByAdminId_fkey"
    FOREIGN KEY ("suspendedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Review: bir müqavilə üzrə hər tərəf qarşı tərəfə ən çox bir rəy yazır.
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Review_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE UNIQUE INDEX "Review_contractId_reviewerId_key" ON "Review"("contractId", "reviewerId");
CREATE INDEX "Review_revieweeId_createdAt_idx" ON "Review"("revieweeId", "createdAt");

ALTER TABLE "Review" ADD CONSTRAINT "Review_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey"
    FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_revieweeId_fkey"
    FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
