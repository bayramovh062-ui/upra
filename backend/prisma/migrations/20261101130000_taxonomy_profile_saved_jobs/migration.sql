-- Mərhələ 1A: kateqoriya, bacarıqlar, saxlanmış işlər, genişlənmiş profil və iş sahələri

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('ENTRY', 'MID', 'SENIOR');

-- CreateEnum
CREATE TYPE "PaymentStructure" AS ENUM ('MILESTONES', 'LUMP_SUM');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'BUSY', 'UNAVAILABLE');

-- AlterEnum
-- DRAFT: client işi hələ dərc etməyib, yalnız özü görür.
-- Qeyd: yeni enum dəyəri eyni tranzaksiyada istifadə olunmur, ona görə təhlükəsizdir.
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'DRAFT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "availability" "Availability" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "JobPost" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "experienceLevel" "ExperienceLevel",
ADD COLUMN     "paymentStructure" "PaymentStructure" NOT NULL DEFAULT 'MILESTONES';

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSkill" (
    "jobPostId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "JobSkill_pkey" PRIMARY KEY ("jobPostId","skillId")
);

-- CreateTable
CREATE TABLE "UserSkill" (
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("userId","skillId")
);

-- CreateTable
CREATE TABLE "SavedJob" (
    "userId" TEXT NOT NULL,
    "jobPostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedJob_pkey" PRIMARY KEY ("userId","jobPostId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");

-- CreateIndex
CREATE INDEX "JobSkill_skillId_idx" ON "JobSkill"("skillId");

-- CreateIndex
CREATE INDEX "UserSkill_skillId_idx" ON "UserSkill"("skillId");

-- CreateIndex
CREATE INDEX "SavedJob_jobPostId_idx" ON "SavedJob"("jobPostId");

-- CreateIndex
CREATE INDEX "JobPost_categoryId_idx" ON "JobPost"("categoryId");

-- AddForeignKey
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSkill" ADD CONSTRAINT "JobSkill_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSkill" ADD CONSTRAINT "JobSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ================= İlkin məlumat (Find Work dizaynındakı kateqoriya və bacarıqlar) =================
-- gen_random_uuid() PostgreSQL 13+ üçün daxilidir. ON CONFLICT: təkrar işləsə də xəta verməsin.

INSERT INTO "Category" ("id", "name", "slug") VALUES
    (gen_random_uuid()::text, 'Fullstack Development',   'fullstack-development'),
    (gen_random_uuid()::text, 'Frontend Development',    'frontend-development'),
    (gen_random_uuid()::text, 'Backend & Systems',       'backend-systems'),
    (gen_random_uuid()::text, 'UI/UX & Product Design',  'ui-ux-product-design'),
    (gen_random_uuid()::text, 'DevOps & Cloud',          'devops-cloud'),
    (gen_random_uuid()::text, 'Mobile Development',      'mobile-development'),
    (gen_random_uuid()::text, 'Data & AI',               'data-ai'),
    (gen_random_uuid()::text, 'QA & Testing',            'qa-testing')
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Skill" ("id", "name", "slug") VALUES
    (gen_random_uuid()::text, 'JavaScript',       'javascript'),
    (gen_random_uuid()::text, 'TypeScript',       'typescript'),
    (gen_random_uuid()::text, 'React',            'react'),
    (gen_random_uuid()::text, 'Next.js',          'next.js'),
    (gen_random_uuid()::text, 'Vue.js',           'vue.js'),
    (gen_random_uuid()::text, 'Node.js',          'node.js'),
    (gen_random_uuid()::text, 'Express',          'express'),
    (gen_random_uuid()::text, 'Python',           'python'),
    (gen_random_uuid()::text, 'Django',           'django'),
    (gen_random_uuid()::text, 'Go',               'go'),
    (gen_random_uuid()::text, 'Rust',             'rust'),
    (gen_random_uuid()::text, 'Java',             'java'),
    (gen_random_uuid()::text, 'PostgreSQL',       'postgresql'),
    (gen_random_uuid()::text, 'MongoDB',          'mongodb'),
    (gen_random_uuid()::text, 'Redis',            'redis'),
    (gen_random_uuid()::text, 'Prisma',           'prisma'),
    (gen_random_uuid()::text, 'GraphQL',          'graphql'),
    (gen_random_uuid()::text, 'REST API',         'rest api'),
    (gen_random_uuid()::text, 'WebSockets',       'websockets'),
    (gen_random_uuid()::text, 'Tailwind CSS',     'tailwind css'),
    (gen_random_uuid()::text, 'HTML & CSS',       'html & css'),
    (gen_random_uuid()::text, 'Figma',            'figma'),
    (gen_random_uuid()::text, 'UI/UX',            'ui/ux'),
    (gen_random_uuid()::text, 'Design Systems',   'design systems'),
    (gen_random_uuid()::text, 'Prototyping',      'prototyping'),
    (gen_random_uuid()::text, 'Docker',           'docker'),
    (gen_random_uuid()::text, 'Kubernetes',       'kubernetes'),
    (gen_random_uuid()::text, 'AWS',              'aws'),
    (gen_random_uuid()::text, 'Terraform',        'terraform'),
    (gen_random_uuid()::text, 'GitHub Actions',   'github actions'),
    (gen_random_uuid()::text, 'CI/CD',            'ci/cd'),
    (gen_random_uuid()::text, 'Linux',            'linux'),
    (gen_random_uuid()::text, 'React Native',     'react native'),
    (gen_random_uuid()::text, 'Flutter',          'flutter'),
    (gen_random_uuid()::text, 'Machine Learning', 'machine learning'),
    (gen_random_uuid()::text, 'Playwright',       'playwright'),
    (gen_random_uuid()::text, 'Jest',             'jest'),
    (gen_random_uuid()::text, 'Stripe API',       'stripe api')
ON CONFLICT ("slug") DO NOTHING;
