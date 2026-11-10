-- CreateEnum
CREATE TYPE "AttachmentPurpose" AS ENUM ('AVATAR', 'MILESTONE_SUBMIT', 'DISPUTE_EVIDENCE', 'ISSUE', 'ISSUE_COMMENT', 'REPORT_EVIDENCE');

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "purpose" "AttachmentPurpose" NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'cloudinary',
    "uploadedById" TEXT NOT NULL,
    "userId" TEXT,
    "contractId" TEXT,
    "milestoneId" TEXT,
    "submissionId" TEXT,
    "disputeId" TEXT,
    "issueId" TEXT,
    "issueCommentId" TEXT,
    "reportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_purpose_createdAt_idx" ON "Attachment"("purpose", "createdAt");

-- CreateIndex
CREATE INDEX "Attachment_userId_idx" ON "Attachment"("userId");

-- CreateIndex
CREATE INDEX "Attachment_contractId_idx" ON "Attachment"("contractId");

-- CreateIndex
CREATE INDEX "Attachment_milestoneId_idx" ON "Attachment"("milestoneId");

-- CreateIndex
CREATE INDEX "Attachment_submissionId_idx" ON "Attachment"("submissionId");

-- CreateIndex
CREATE INDEX "Attachment_disputeId_idx" ON "Attachment"("disputeId");

-- CreateIndex
CREATE INDEX "Attachment_issueId_idx" ON "Attachment"("issueId");

-- CreateIndex
CREATE INDEX "Attachment_issueCommentId_idx" ON "Attachment"("issueCommentId");

-- CreateIndex
CREATE INDEX "Attachment_reportId_idx" ON "Attachment"("reportId");

-- CreateIndex
CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- submissionId, disputeId, reportId foreign key-ləri burada deyil: MilestoneSubmission, Dispute və Report cədvəlləri
-- sonrakı 20261109120000_p2_... migrasiyasında yaradılır. Boş bazada bu sətirlər burada işləsə migrasiya sınırdı.
-- Onlar 20261110150000_attachment_late_foreign_keys migrasiyasında əlavə olunur.

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_issueCommentId_fkey" FOREIGN KEY ("issueCommentId") REFERENCES "IssueComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
