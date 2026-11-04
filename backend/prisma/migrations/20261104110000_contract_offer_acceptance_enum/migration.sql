-- P0 #2: müqavilə təklifi statusları.
-- PENDING_ACCEPTANCE: client təklifi qəbul edib, frilanserin razılığı gözlənilir.
-- DECLINED: frilanser təklifi rədd edib.
-- Ayrıca fayldır: PostgreSQL yeni enum dəyərini əlavə edildiyi tranzaksiyada istifadə etməyə icazə vermir,
-- ona görə bu faylda başqa heç nə dəyişdirilmir.
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'PENDING_ACCEPTANCE';
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
