-- AlterEnum
-- Frilanser işi təhvil verəndə müqavilə DELIVERED olur (client baxır, lövhə read-only).
-- IF NOT EXISTS: dev bazasına bu dəyər əl ilə və ya "db push" ilə artıq əlavə olunubsa, migration xəta verməsin.
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
