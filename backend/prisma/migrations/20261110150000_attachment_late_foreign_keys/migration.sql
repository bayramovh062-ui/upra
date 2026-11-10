-- Attachment -> MilestoneSubmission / Dispute / Report foreign key-ləri.
--
-- Bu cədvəllər 20261109120000_p2_revision_dispute_admin_report migrasiyasında yaradılır, plan3 migrasiyası isə
-- ondan əvvəl işləyir. Əvvəllər FK-lər plan3-də idi və boş bazada migrasiya sınırdı (cədvəl hələ yox idi).
--
-- Köhnə bazalarda (dev, test, canlı) bu constraint-lər plan3 vasitəsilə artıq yaradılıb. Ona görə hər biri
-- "artıq varsa keç" qoruması ilə əlavə olunur: yeni bazada yaranır, köhnə bazada heç nə dəyişmir.

DO $$
BEGIN
    ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_submissionId_fkey"
        FOREIGN KEY ("submissionId") REFERENCES "MilestoneSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_disputeId_fkey"
        FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_reportId_fkey"
        FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;
