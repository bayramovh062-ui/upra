-- P0 #2: frilanserin müqavilə şərtlərini qəbul/rədd etmə anı.
-- Enum dəyərləri əvvəlki migrasiyada əlavə olunub (PostgreSQL məhdudiyyəti).
ALTER TABLE "Contract" ADD COLUMN "freelancerAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN "freelancerDeclinedAt" TIMESTAMP(3);
