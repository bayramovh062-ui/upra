import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/db.js';
import { topUp, fundMilestone, submitMilestone, approveMilestone } from '../../src/services/financialService.js';

// Verilən e-poçtların sahibi olan istifadəçiləri və onlara bağlı bütün məlumatı FK sırası ilə silir
export const cleanUpUsers = async (emails) => {
    const users = await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true },
    });
    await cleanUpUserIds(users.map((u) => u.id));
};

// Soft-delete olunmuş hesabların e-poçtu dəyişir, ona görə onları id ilə təmizləmək lazımdır
// (SavedJob, JobSkill, UserSkill FK-ları CASCADE-dir, ayrıca silmək lazım deyil)
export const cleanUpUserIds = async (ids) => {
    if (ids.length === 0) return;

    const contractWhere = { OR: [{ clientId: { in: ids } }, { freelancerId: { in: ids } }] };

    // Plan P3: attachments reference users/contracts/milestones/submissions/disputes/issues/reports (some RESTRICT)
    await prisma.attachment.deleteMany({
        where: {
            OR: [
                { uploadedById: { in: ids } },
                { userId: { in: ids } },
                { contract: contractWhere },
                { issue: { board: { contract: contractWhere } } },
                { issueComment: { issue: { board: { contract: contractWhere } } } },
                { report: { OR: [{ reporterId: { in: ids } }, { adminId: { in: ids } }] } },
            ],
        },
    });

    // P2 cədvəlləri (Report/Dispute/MilestoneSubmission) user FK-ları RESTRICT ola bilər: əvvəl onları sil
    await prisma.report.deleteMany({
        where: { OR: [{ reporterId: { in: ids } }, { adminId: { in: ids } }] },
    });
    await prisma.dispute.deleteMany({
        where: { OR: [{ openedById: { in: ids } }, { contract: contractWhere }] },
    });
    await prisma.milestoneSubmission.deleteMany({
        where: { OR: [{ actorId: { in: ids } }, { contract: contractWhere }] },
    });
    // P3: Review reviewer/reviewee FK-ları RESTRICT-dir; müqavilə silinməzdən əvvəl təmizlənir
    await prisma.review.deleteMany({
        where: {
            OR: [{ reviewerId: { in: ids } }, { revieweeId: { in: ids } }, { contract: contractWhere }],
        },
    });

    // Maliyyə cədvəlləri RESTRICT-dir: əvvəl ledger, sonra mərhələ və pul kisəsi (yalnız test bazasında)
    await prisma.transaction.deleteMany({
        where: { OR: [{ wallet: { userId: { in: ids } } }, { milestone: { contract: contractWhere } }] },
    });
    await prisma.issue.updateMany({ where: { milestone: { contract: contractWhere } }, data: { milestoneId: null } });
    await prisma.milestone.deleteMany({ where: { contract: contractWhere } });
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });

    await prisma.issueComment.deleteMany({ where: { issue: { board: { contract: contractWhere } } } });
    await prisma.issueComment.deleteMany({ where: { authorId: { in: ids } } });
    await prisma.issue.deleteMany({ where: { board: { contract: contractWhere } } });
    await prisma.board.deleteMany({ where: { contract: contractWhere } });
    await prisma.contract.deleteMany({ where: contractWhere });
    await prisma.proposal.deleteMany({
        where: { OR: [{ freelancerId: { in: ids } }, { jobPost: { clientId: { in: ids } } }] },
    });
    await prisma.jobPost.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
};

// Testlərin yaratdığı bacarıqları silir (JobSkill və UserSkill CASCADE ilə gedir).
// Seed olunmuş bacarıqlara toxunmamaq üçün testlər "zz-" ilə başlayan adlar işlətməlidir.
export const cleanUpTestSkills = async () => {
    await prisma.skill.deleteMany({ where: { slug: { startsWith: 'zz-' } } });
};

// Qeydiyyat: { token, user } qaytarır
export const registerUser = async (data) => {
    const res = await request(app).post('/api/auth/register').send(data);
    if (res.status !== 201) {
        throw new Error(`registerUser failed (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return { token: res.body.token, user: res.body.user };
};

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

export const createJob = async (token, overrides = {}) => {
    const res = await request(app)
        .post('/api/jobs')
        .set(auth(token))
        .send({
            title: 'Generic test job title',
            description: 'A sufficiently long description for the test job post.',
            budget: 1000,
            ...overrides,
        });
    if (res.status !== 201) throw new Error(`createJob failed: ${JSON.stringify(res.body)}`);
    return res.body.job;
};

export const createProposal = async (token, jobPostId, overrides = {}) => {
    const res = await request(app)
        .post('/api/proposals')
        .set(auth(token))
        .send({
            jobPostId,
            coverLetter: 'This is a cover letter that is long enough to pass validation.',
            bidAmount: 900,
            ...overrides,
        });
    if (res.status !== 201) throw new Error(`createProposal failed: ${JSON.stringify(res.body)}`);
    return res.body.proposal;
};

// Contract yaradır. freelancerToken verilərsə, təklif dərhal frilanser tərəfindən qəbul edilir
// (müqavilə ACTIVE olur) — beləliklə mövcud testlər əvvəlki davranışı qoruyur.
export const createContract = async (clientToken, proposalId, freelancerToken) => {
    const res = await request(app).post('/api/contracts').set(auth(clientToken)).send({ proposalId });
    if (res.status !== 201) throw new Error(`createContract failed: ${JSON.stringify(res.body)}`);

    if (!freelancerToken) return res.body.contract;

    const acceptRes = await request(app)
        .patch(`/api/contracts/${res.body.contract.id}/accept`)
        .set(auth(freelancerToken));
    if (acceptRes.status !== 200) throw new Error(`acceptContract failed: ${JSON.stringify(acceptRes.body)}`);

    return acceptRes.body.contract;
};

// Pul qapıları (P0): lövhədə işə başlamaq üçün escrow-da pul olmalıdır. Test köməkçiləri xidmət qatından keçir
// (HTTP rate limiter və DEMO_TOPUP_ENABLED-dən asılı olmasın deyə).

// Müqavilənin ilk PENDING mərhələsini client-in pul kisəsini doldurub maliyyələşdirir (FUNDED). Mərhələni qaytarır.
export const fundContract = async (clientId, contractId) => {
    const milestone = await prisma.milestone.findFirst({
        where: { contractId, status: 'PENDING' },
        orderBy: { sequence: 'asc' },
    });
    if (!milestone) throw new Error('fundContract: no PENDING milestone');
    await topUp(clientId, milestone.amountCents);
    await fundMilestone(milestone.id, clientId);
    return milestone;
};

// Bütün mərhələləri ardıcıl maliyyələşdirir, təhvil verir və təsdiqləyir (hamısı PAID olur)
export const payAllMilestones = async (clientId, freelancerId, contractId) => {
    const milestones = await prisma.milestone.findMany({ where: { contractId }, orderBy: { sequence: 'asc' } });
    for (const milestone of milestones) {
        const current = await prisma.milestone.findUnique({ where: { id: milestone.id } });
        if (current.status === 'PENDING') {
            await topUp(clientId, milestone.amountCents);
            await fundMilestone(milestone.id, clientId);
        }
        if (['PENDING', 'FUNDED'].includes(current.status)) {
            await submitMilestone(milestone.id, freelancerId);
        }
        await approveMilestone(milestone.id, { actorId: clientId });
    }
};

export { app, prisma };
