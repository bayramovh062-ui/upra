import request from 'supertest';
import { app, prisma, auth, cleanUpUsers, registerUser, createJob, createProposal } from './helpers/db.js';

const PASSWORD = 'Password123!';

// P0 #2: client təklif göndərir → frilanser qəbul/rədd edir → müqavilə aktivləşir.
describe('Contract offer: freelancer acceptance workflow', () => {
    const emails = [
        'offer_client@upra.com',
        'offer_free1@upra.com',
        'offer_free2@upra.com',
        'offer_outsider@upra.com',
    ];

    let client;
    let freelancer;
    let otherFreelancer;
    let outsider;
    let jobSeq = 0;

    const createOffer = (token, proposalId, milestones) =>
        request(app)
            .post('/api/contracts')
            .set(auth(token))
            .send(milestones ? { proposalId, milestones } : { proposalId });

    const respond = (token, contractId, action) =>
        request(app).patch(`/api/contracts/${contractId}/${action}`).set(auth(token));

    // Hər test üçün təzə iş + təklif (job kilidi səbəbi ilə təkrar istifadə olunmur)
    const freshProposal = async (bidAmount = 500, title = 'Offer workflow job') => {
        jobSeq += 1;
        const job = await createJob(client.token, { title: `${title} ${jobSeq}` });
        const proposal = await createProposal(freelancer.token, job.id, { bidAmount });
        return { job, proposal };
    };

    beforeAll(async () => {
        await cleanUpUsers(emails);

        client = await registerUser({ email: emails[0], password: PASSWORD, fullName: 'Offer Client', role: 'CLIENT' });
        freelancer = await registerUser({ email: emails[1], password: PASSWORD, fullName: 'Offer Freelancer', role: 'FREELANCER' });
        otherFreelancer = await registerUser({ email: emails[2], password: PASSWORD, fullName: 'Other Freelancer', role: 'FREELANCER' });
        outsider = await registerUser({ email: emails[3], password: PASSWORD, fullName: 'Outsider', role: 'FREELANCER' });
    });

    afterAll(async () => {
        await cleanUpUsers(emails);
        await prisma.$disconnect();
    });

    it('creates a PENDING_ACCEPTANCE offer that cannot be worked on or funded yet', async () => {
        const { job, proposal } = await freshProposal(500);

        const res = await createOffer(client.token, proposal.id, [
            { title: 'Design', amount: 200 },
            { title: 'Build', amount: 300 },
        ]);

        expect(res.status).toBe(201);
        expect(res.body.contract.status).toBe('PENDING_ACCEPTANCE');
        expect(res.body.contract.freelancerAcceptedAt).toBeNull();
        expect(res.body.contract.milestones).toHaveLength(2);

        const contractId = res.body.contract.id;
        const milestoneId = res.body.contract.milestones[0].id;

        // Təklif mərhələsi: iş kilidlənib, təklif ACCEPTED, amma pul hərəkəti və lövhə yazısı yoxdur
        expect((await prisma.proposal.findUnique({ where: { id: proposal.id } })).status).toBe('ACCEPTED');
        expect((await prisma.jobPost.findUnique({ where: { id: job.id } })).status).toBe('IN_PROGRESS');

        const detail = await request(app).get(`/api/contracts/${contractId}`).set(auth(freelancer.token));
        expect(detail.status).toBe(200);
        expect(detail.body.contract.workStarted).toBe(false);

        const issue = await request(app)
            .post(`/api/contracts/${contractId}/issues`)
            .set(auth(client.token))
            .send({ title: 'Issue before acceptance' });
        expect(issue.status).toBe(400);
        expect(issue.body.message).toMatch(/not active/i);

        const fund = await request(app).post(`/api/milestones/${milestoneId}/fund`).set(auth(client.token));
        expect(fund.status).toBe(400);
        expect(fund.body.message).toMatch(/not active/i);

        // Heç bir ledger yazısı yaranmayıb
        expect(await prisma.transaction.count({ where: { milestoneId } })).toBe(0);
    });

    it('lets only the contract freelancer accept or decline', async () => {
        const { proposal } = await freshProposal();
        const offer = await createOffer(client.token, proposal.id);
        const contractId = offer.body.contract.id;

        expect((await respond(client.token, contractId, 'accept')).status).toBe(403);
        expect((await respond(outsider.token, contractId, 'accept')).status).toBe(403);
        expect((await respond(otherFreelancer.token, contractId, 'accept')).status).toBe(403);

        expect((await respond(client.token, contractId, 'decline')).status).toBe(403);
        expect((await respond(otherFreelancer.token, contractId, 'decline')).status).toBe(403);

        const stored = await prisma.contract.findUnique({ where: { id: contractId } });
        expect(stored.status).toBe('PENDING_ACCEPTANCE');
    });

    it('activates the contract on accept and rejects the other pending proposals', async () => {
        const job = await createJob(client.token, { title: 'Job with two proposals' });
        const chosen = await createProposal(freelancer.token, job.id, { bidAmount: 700 });
        const rival = await createProposal(otherFreelancer.token, job.id, { bidAmount: 650 });

        const offer = await createOffer(client.token, chosen.id);
        const contractId = offer.body.contract.id;

        // Rəqib təklif hələ PENDING-dir: seçim frilanserin cavabı ilə tamamlanır
        expect((await prisma.proposal.findUnique({ where: { id: rival.id } })).status).toBe('PENDING');

        const res = await respond(freelancer.token, contractId, 'accept');

        expect(res.status).toBe(200);
        expect(res.body.contract.status).toBe('ACTIVE');
        expect(res.body.contract.freelancerAcceptedAt).toBeTruthy();
        expect(res.body.contract.milestones).toHaveLength(1);

        expect((await prisma.proposal.findUnique({ where: { id: chosen.id } })).status).toBe('ACCEPTED');
        expect((await prisma.proposal.findUnique({ where: { id: rival.id } })).status).toBe('REJECTED');
        expect((await prisma.jobPost.findUnique({ where: { id: job.id } })).status).toBe('IN_PROGRESS');

        // İkinci dəfə qəbul etmək olmur
        const again = await respond(freelancer.token, contractId, 'accept');
        expect(again.status).toBe(400);
        expect(again.body.message).toMatch(/no longer pending/i);

        // Qəbuldan sonra rədd etmək də olmur
        expect((await respond(freelancer.token, contractId, 'decline')).status).toBe(400);
    });

    it('declines the offer, closes the proposal and reopens the job for another candidate', async () => {
        const job = await createJob(client.token, { title: 'Job that gets declined' });
        const first = await createProposal(freelancer.token, job.id, { bidAmount: 400 });
        const backup = await createProposal(otherFreelancer.token, job.id, { bidAmount: 450 });

        const offer = await createOffer(client.token, first.id);
        const contractId = offer.body.contract.id;

        const res = await respond(freelancer.token, contractId, 'decline');

        expect(res.status).toBe(200);
        expect(res.body.contract.status).toBe('DECLINED');
        expect(res.body.contract.freelancerDeclinedAt).toBeTruthy();
        expect(res.body.contract.milestones).toHaveLength(1);

        expect((await prisma.proposal.findUnique({ where: { id: first.id } })).status).toBe('REJECTED');
        expect((await prisma.jobPost.findUnique({ where: { id: job.id } })).status).toBe('OPEN');

        // İş yenidən açıldığı üçün client digər təklifi qəbul edə bilər
        const secondOffer = await createOffer(client.token, backup.id);
        expect(secondOffer.status).toBe(201);
        expect(secondOffer.body.contract.status).toBe('PENDING_ACCEPTANCE');

        // Rədd edilmiş müqavilə tarixçədə qalır
        const stored = await prisma.contract.findUnique({ where: { id: contractId } });
        expect(stored.status).toBe('DECLINED');
        expect(await prisma.contract.count({ where: { jobPostId: job.id } })).toBe(2);
    });

    it('resolves a concurrent accept and decline to exactly one transition', async () => {
        const { proposal } = await freshProposal();
        const offer = await createOffer(client.token, proposal.id);
        const contractId = offer.body.contract.id;

        const [accept, decline] = await Promise.all([
            respond(freelancer.token, contractId, 'accept'),
            respond(freelancer.token, contractId, 'decline'),
        ]);

        const statuses = [accept.status, decline.status].sort();
        expect(statuses).toEqual([200, 400]);

        const stored = await prisma.contract.findUnique({ where: { id: contractId } });
        const storedProposal = await prisma.proposal.findUnique({ where: { id: proposal.id } });
        const storedJob = await prisma.jobPost.findUnique({ where: { id: proposal.jobPostId } });

        expect(['ACTIVE', 'DECLINED']).toContain(stored.status);
        expect(stored.freelancerAcceptedAt === null).toBe(stored.status === 'DECLINED');
        expect(stored.freelancerDeclinedAt === null).toBe(stored.status === 'ACTIVE');

        if (stored.status === 'ACTIVE') {
            expect(storedProposal.status).toBe('ACCEPTED');
            expect(storedJob.status).toBe('IN_PROGRESS');
        } else {
            expect(storedProposal.status).toBe('REJECTED');
            expect(storedJob.status).toBe('OPEN');
        }
    });

    it('returns 404 for an unknown contract offer', async () => {
        const missingId = '00000000-0000-0000-0000-000000000000';

        expect((await respond(freelancer.token, missingId, 'accept')).status).toBe(404);
        expect((await respond(freelancer.token, missingId, 'decline')).status).toBe(404);
    });
});
