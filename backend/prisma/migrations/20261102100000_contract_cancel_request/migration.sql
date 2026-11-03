-- AlterTable: müqavilə ləğv təklifi (iş başlayandan sonra qarşılıqlı razılıq)
ALTER TABLE "Contract"
    ADD COLUMN "cancelRequestedById" TEXT,
    ADD COLUMN "cancelRequestedAt" TIMESTAMP(3),
    ADD COLUMN "cancelReason" TEXT;
