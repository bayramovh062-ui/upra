-- Mərhələ 1D: profil görünürlüyü. false olanda başqaları yalnız ad və rolu görür
ALTER TABLE "User" ADD COLUMN "profilePublic" BOOLEAN NOT NULL DEFAULT true;
