-- Mərhələ 2B: ləğv olunmuş müqavilənin mərhələləri üçün CANCELLED statusu.
-- Ayrıca migrasiyadır: PostgreSQL yeni enum dəyərini əlavə edildiyi tranzaksiyada istifadə etməyə icazə vermir,
-- ona görə bu fayla başqa heç nə qarışdırılmır.
ALTER TYPE "MilestoneStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
