import request from 'supertest';
import {
    app,
    prisma,
    auth,
    registerUser,
    createJob,
    createProposal,
} from './db.js';
import { topUp, fundMilestone, submitMilestone } from '../../src/services/financialService.js';

export const PASSWORD = 'Password123!';

export const pairEmails = (prefix, n) => ({
    client: `${prefix}_c${n}@upra.com`,
    freelancer: `${prefix}_f${n}@upra.com`,
});

export const registerPair = async (prefix, n) => {
    const email = pairEmails(prefix, n);
    const c = await registerUser({
        email: email.client,
        password: PASSWORD,
        fullName: `P2 Client ${n}`,
        role: 'CLIENT',
    });
    const f = await registerUser({
        email: email.freelancer,
        password: PASSWORD,
        fullName: `P2 Freelancer ${n}`,
        role: 'FREELANCER',
    });
    return { c, f };
};

export const registerAdmin = async (email) => {
    const admin = await registerUser({
        email,
        password: PASSWORD,
        fullName: 'P2 Admin',
        role: 'CLIENT',
    });
    // ADMIN yalnız controlled bootstrap ilə verilir; testdə birbaşa DB-də edirik
    await prisma.user.update({ where: { id: admin.user.id }, data: { role: 'ADMIN' } });
    return admin;
};

export const api = {
    get: (token, url) => request(app).get(url).set(auth(token)),
    post: (token, url, body) => request(app).post(url).set(auth(token)).send(body),
    patch: (token, url, body) => request(app).patch(url).set(auth(token)).send(body),
};

// milestones: [{ title, amount (USD), maxRevisions? }]. Cəmi təklifin məbləği olur.
export const createContractWithMilestones = async ({
    clientToken,
    freelancerToken,
    milestones,
    title = 'P2 contract',
}) => {
    const plan = milestones ?? [{ title: 'Delivery', amount: 100 }];
    const total = plan.reduce((sum, m) => sum + m.amount, 0);

    const job = await createJob(clientToken, { title, budget: total + 500 });
    const proposal = await createProposal(freelancerToken, job.id, { bidAmount: total });

    const res = await api.post(clientToken, '/api/contracts', {
        proposalId: proposal.id,
        milestones: plan.map((m) => ({
            title: m.title,
            amount: m.amount,
            maxRevisions: m.maxRevisions ?? 2,
        })),
    });
    if (res.status !== 201) throw new Error(`createContract failed: ${JSON.stringify(res.body)}`);

    const accepted = await api.patch(freelancerToken, `/api/contracts/${res.body.contract.id}/accept`);
    if (accepted.status !== 200) throw new Error(`acceptContract failed: ${JSON.stringify(accepted.body)}`);

    return accepted.body.contract;
};

// Client pul kisəsini doldurur, mərhələni maliyyələşdirir və frilanser təhvil verir (IN_REVIEW).
export const fundAndSubmit = async (clientId, freelancerId, milestone) => {
    await topUp(clientId, milestone.amountCents);
    await fundMilestone(milestone.id, clientId);
    await submitMilestone(milestone.id, freelancerId);
    return prisma.milestone.findUniqueOrThrow({ where: { id: milestone.id } });
};

export const walletOf = (userId) => prisma.wallet.findUnique({ where: { userId } });

export const milestoneLedger = (milestoneId) =>
    prisma.transaction.findMany({
        where: { milestoneId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
