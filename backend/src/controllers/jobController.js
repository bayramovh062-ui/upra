import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { resolveSkillIds, flattenSkills, computeMatchScore, toSlug } from '../utils/skills.js';

const EXPERIENCE_LEVELS = ['ENTRY', 'MID', 'SENIOR'];
const PAYMENT_STRUCTURES = ['MILESTONES', 'LUMP_SUM'];
const JOB_STATUSES = ['DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

// ---------- köməkçilər ----------

const skillSelect = { select: { skill: { select: { id: true, name: true, slug: true } } } };

// Hər iş cavabında eyni sahələr qayıdır; userId verilibsə "saxlanıb?" da gəlir
const jobInclude = (userId) => ({
    client: { select: { id: true, fullName: true } },
    category: { select: { id: true, name: true, slug: true } },
    skills: skillSelect,
    _count: { select: { proposals: true } },
    ...(userId && { savedBy: { where: { userId }, select: { userId: true } } }),
});

// Prisma sətrini API formatına çevirir: skills düz siyahı, isSaved, matchScore (yalnız frilanser üçün)
const serializeJob = (job, userSkillIds) => {
    const { skills, savedBy, ...rest } = job;
    const flat = flattenSkills(skills);
    return {
        ...rest,
        skills: flat,
        ...(savedBy !== undefined && { isSaved: savedBy.length > 0 }),
        ...(userSkillIds && { matchScore: computeMatchScore(flat.map((s) => s.id), userSkillIds) }),
    };
};

// ?a=x,y və ?a=x&a=y hər ikisi işləsin
const parseCsv = (value) =>
    [].concat(value ?? [])
        .flatMap((v) => (typeof v === 'string' ? v.split(',') : []))
        .map((v) => v.trim())
        .filter(Boolean);

const getUserSkillIds = async (userId) => {
    const rows = await prisma.userSkill.findMany({ where: { userId }, select: { skillId: true } });
    return new Set(rows.map((r) => r.skillId));
};

const assertCategoryExists = async (categoryId) => {
    if (!categoryId) return;
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) throw new AppError('Category not found', 400);
};

// ---------- siyahı (Find Work) ----------

const listJobs = async (req, res, forcedTab) => {
    const user = req.user || null;
    const tab = forcedTab || (['saved', 'matched'].includes(req.query.tab) ? req.query.tab : 'all');

    if (tab !== 'all') {
        if (!user) throw new AppError('Please log in to use this tab', 401);
        if (user.role !== 'FREELANCER') throw new AppError('Only freelancers have saved and matched jobs', 403);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const skip = (page - 1) * limit;

    // Büdcə filtri: yalnız müsbət rəqəm qəbul olunur
    const minBudget = Number(req.query.minBudget);
    const maxBudget = Number(req.query.maxBudget);
    const budgetFilter = {
        ...(Number.isFinite(minBudget) && minBudget > 0 && { gte: minBudget }),
        ...(Number.isFinite(maxBudget) && maxBudget > 0 && { lte: maxBudget }),
    };

    const SORT_OPTIONS = {
        newest: { createdAt: 'desc' },
        budget_desc: { budget: 'desc' },
        budget_asc: { budget: 'asc' },
        proposals_desc: { proposals: { _count: 'desc' } },
    };
    const orderBy = SORT_OPTIONS[req.query.sort] || SORT_OPTIONS.newest;

    // Giriş edən frilanserin bacarıqları: matchScore və "matched" tab-ı üçün
    const userSkillIds = user?.role === 'FREELANCER' ? await getUserSkillIds(user.id) : null;

    const categorySlugs = parseCsv(req.query.category).map((s) => s.toLowerCase());
    const levels = parseCsv(req.query.experienceLevel)
        .map((s) => s.toUpperCase())
        .filter((s) => EXPERIENCE_LEVELS.includes(s));
    const paymentStructure = String(req.query.paymentStructure || '').toUpperCase();
    const skillSlugs = parseCsv(req.query.skills).map(toSlug);
    const requireAllSkills = req.query.skillsMode === 'all';

    const and = [];

    if (categorySlugs.length > 0) and.push({ category: { slug: { in: categorySlugs } } });
    if (levels.length > 0) and.push({ experienceLevel: { in: levels } });
    if (PAYMENT_STRUCTURES.includes(paymentStructure)) and.push({ paymentStructure });

    if (skillSlugs.length > 0) {
        if (requireAllSkills) {
            for (const slug of skillSlugs) and.push({ skills: { some: { skill: { slug } } } });
        } else {
            and.push({ skills: { some: { skill: { slug: { in: skillSlugs } } } } });
        }
    }

    if (search) {
        and.push({
            OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { skills: { some: { skill: { name: { contains: search, mode: 'insensitive' } } } } },
            ],
        });
    }

    if (tab === 'saved') and.push({ savedBy: { some: { userId: user.id } } });
    if (tab === 'matched') {
        and.push({ skills: { some: { skillId: { in: [...userSkillIds] } } } });
    }

    const where = {
        status: 'OPEN', // DRAFT, ləğv olunmuş və başlamış işlər siyahıda görünmür
        ...(Object.keys(budgetFilter).length > 0 && { budget: budgetFilter }),
        ...(and.length > 0 && { AND: and }),
    };

    const [jobs, total] = await Promise.all([
        prisma.jobPost.findMany({
            where,
            include: jobInclude(user?.id),
            orderBy,
            skip,
            take: limit,
        }),
        prisma.jobPost.count({ where }),
    ]);

    // Tab sayları (giriş edən frilanser üçün)
    let tabCounts;
    if (user?.role === 'FREELANCER') {
        const [saved, matched] = await Promise.all([
            prisma.savedJob.count({ where: { userId: user.id, jobPost: { status: 'OPEN' } } }),
            userSkillIds.size > 0
                ? prisma.jobPost.count({
                      where: { status: 'OPEN', skills: { some: { skillId: { in: [...userSkillIds] } } } },
                  })
                : Promise.resolve(0),
        ]);
        tabCounts = { saved, matched };
    }

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
        success: true,
        count: jobs.length,
        pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
        ...(tabCounts && { tabCounts }),
        jobs: jobs.map((job) => serializeJob(job, userSkillIds)),
    });
};

// @route   GET /api/jobs   (giriş məcburi deyil; ?tab=saved|matched üçün frilanser girişi lazımdır)
export const getAllJobs = asyncHandler((req, res) => listJobs(req, res));

// @route   GET /api/jobs/saved
export const getSavedJobs = asyncHandler((req, res) => listJobs(req, res, 'saved'));

// ---------- yaratma / oxuma / redaktə ----------

// @route   POST /api/jobs
export const createJob = asyncHandler(async (req, res) => {
    const { skills, status, ...data } = req.body;

    await assertCategoryExists(data.categoryId);

    const job = await prisma.$transaction(async (tx) => {
        const skillIds = skills?.length ? await resolveSkillIds(tx, skills) : [];

        return tx.jobPost.create({
            data: {
                ...data,
                status: status || 'OPEN',
                clientId: req.user.id,
                skills: { create: skillIds.map((skillId) => ({ skillId })) },
            },
            include: jobInclude(),
        });
    });

    res.status(201).json({ success: true, job: serializeJob(job) });
});

// @route   GET /api/jobs/:id
export const getJob = asyncHandler(async (req, res) => {
    const job = await prisma.jobPost.findUnique({
        where: { id: req.params.id },
        include: {
            ...jobInclude(req.user.id),
            client: { select: { id: true, fullName: true, createdAt: true } },
        },
    });

    // Qaralama yalnız sahibinə görünür; başqaları üçün elan sanki yoxdur
    if (!job || (job.status === 'DRAFT' && job.clientId !== req.user.id)) {
        throw new AppError('Job not found', 404);
    }

    // Frilanser üçün: bu işə artıq təklif göndərib-göndərmədiyi və bacarıq uyğunluğu
    let myProposal = null;
    let userSkillIds = null;
    if (req.user.role === 'FREELANCER') {
        [myProposal, userSkillIds] = await Promise.all([
            prisma.proposal.findUnique({
                where: {
                    jobPostId_freelancerId: { jobPostId: job.id, freelancerId: req.user.id },
                },
                select: { id: true, coverLetter: true, bidAmount: true, status: true, createdAt: true },
            }),
            getUserSkillIds(req.user.id),
        ]);
    }

    res.status(200).json({ success: true, job: serializeJob(job, userSkillIds), myProposal });
});

// @route   PATCH /api/jobs/:id
export const updateJob = asyncHandler(async (req, res) => {
    const job = await prisma.jobPost.findUnique({ where: { id: req.params.id } });

    if (!job) {
        throw new AppError('Job not found', 404);
    }

    if (job.clientId !== req.user.id) {
        throw new AppError('You can only update your own job posts', 403);
    }

    if (job.status !== 'OPEN' && job.status !== 'DRAFT') {
        throw new AppError('You can only update with open status job', 400);
    }

    const { skills, ...data } = req.body;

    await assertCategoryExists(data.categoryId);

    const updatedJob = await prisma.$transaction(async (tx) => {
        if (skills !== undefined) {
            const skillIds = await resolveSkillIds(tx, skills);
            await tx.jobSkill.deleteMany({ where: { jobPostId: job.id } });
            if (skillIds.length > 0) {
                await tx.jobSkill.createMany({ data: skillIds.map((skillId) => ({ jobPostId: job.id, skillId })) });
            }
        }

        return tx.jobPost.update({
            where: { id: job.id },
            data,
            include: jobInclude(),
        });
    });

    res.status(200).json({ success: true, job: serializeJob(updatedJob) });
});

// @route   POST /api/jobs/:id/publish
// Qaralamanı dərc edir (DRAFT -> OPEN)
export const publishJob = asyncHandler(async (req, res) => {
    const job = await prisma.jobPost.findUnique({ where: { id: req.params.id } });

    if (!job) {
        throw new AppError('Job not found', 404);
    }

    if (job.clientId !== req.user.id) {
        throw new AppError('You can only publish your own job posts', 403);
    }

    if (job.status !== 'DRAFT') {
        throw new AppError('Only draft jobs can be published', 400);
    }

    // Qaralama uzun müddət qala bilər: son tarix keçibsə əvvəl yenilənməlidir
    if (job.deadline && job.deadline.getTime() <= Date.now()) {
        throw new AppError('The deadline has already passed. Update it before publishing.', 400);
    }

    const published = await prisma.jobPost.update({
        where: { id: job.id },
        data: { status: 'OPEN' },
        include: jobInclude(),
    });

    res.status(200).json({ success: true, job: serializeJob(published) });
});

// @route   DELETE /api/jobs/:id
// Heç nə bazadan silinmir (soft delete): OPEN və DRAFT işlər CANCELLED statusuna keçir.
// Bu, gələcək log/audit sistemi üçün tarixçəni saxlayır.
export const deleteJob = asyncHandler(async (req, res) => {
    const job = await prisma.jobPost.findUnique({ where: { id: req.params.id } });

    if (!job) {
        throw new AppError('Job not found', 404);
    }

    if (job.clientId !== req.user.id) {
        throw new AppError('You can only delete your own job posts', 403);
    }

    if (job.status !== 'OPEN' && job.status !== 'DRAFT') {
        throw new AppError('You can only delete with open status job', 400);
    }

    // Elan ləğv olunanda gözləyən təkliflər də bağlanır, yoxsa frilanserlərdə PENDING qalardı
    await prisma.$transaction([
        prisma.jobPost.update({
            where: { id: job.id },
            data: { status: 'CANCELLED' },
        }),
        prisma.proposal.updateMany({
            where: { jobPostId: job.id, status: 'PENDING' },
            data: { status: 'REJECTED' },
        }),
    ]);

    res.status(200).json({ success: true, message: 'Job cancelled successfully' });
});

// @route   GET /api/jobs/my   (?status=DRAFT,OPEN kimi süzmək olar)
export const getMyJobs = asyncHandler(async (req, res) => {
    const statuses = parseCsv(req.query.status)
        .map((s) => s.toUpperCase())
        .filter((s) => JOB_STATUSES.includes(s));

    const jobs = await prisma.jobPost.findMany({
        where: { clientId: req.user.id, ...(statuses.length > 0 && { status: { in: statuses } }) },
        include: jobInclude(),
        orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, count: jobs.length, jobs: jobs.map((job) => serializeJob(job)) });
});

// ---------- saxlanmış işlər ----------

// @route   POST /api/jobs/:id/save
// @access  FREELANCER. Təkrar çağırış xəta vermir (idempotent).
export const saveJob = asyncHandler(async (req, res) => {
    const job = await prisma.jobPost.findUnique({
        where: { id: req.params.id },
        select: { id: true, status: true },
    });

    if (!job || job.status === 'DRAFT') {
        throw new AppError('Job not found', 404);
    }

    if (job.status !== 'OPEN') {
        throw new AppError('Only open jobs can be saved', 400);
    }

    await prisma.savedJob.upsert({
        where: { userId_jobPostId: { userId: req.user.id, jobPostId: job.id } },
        update: {},
        create: { userId: req.user.id, jobPostId: job.id },
    });

    res.status(200).json({ success: true, saved: true });
});

// @route   DELETE /api/jobs/:id/save
export const unsaveJob = asyncHandler(async (req, res) => {
    await prisma.savedJob.deleteMany({
        where: { userId: req.user.id, jobPostId: req.params.id },
    });

    res.status(200).json({ success: true, saved: false });
});
