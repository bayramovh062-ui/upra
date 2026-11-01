import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/db.js';

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

export const createContract = async (clientToken, proposalId) => {
    const res = await request(app).post('/api/contracts').set(auth(clientToken)).send({ proposalId });
    if (res.status !== 201) throw new Error(`createContract failed: ${JSON.stringify(res.body)}`);
    return res.body.contract;
};

export { app, prisma };
