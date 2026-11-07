import request from 'supertest';
import { app, prisma, auth, cleanUpUsers, registerUser, createJob, createProposal } from './helpers/db.js';

const PASSWORD = 'Password123!';
const emails = ['ntfi_client@upra.com', 'ntfi_free@upra.com', 'ntfi_other@upra.com'];

// P1: tapşırıq təyinatı və şərh bildirişləri (hadisə yalnız doğru şəxsə, bir dəfə, doğru linklə yazılır)
describe('Task notifications', () => {
    let client;
    let freelancer;
    let other;
    let contract;

    const list = (user) => request(app).get('/api/notifications?limit=100').set(auth(user.token));
    const notes = async (user) => (await list(user)).body.notifications;
    const types = async (user) => (await notes(user)).map((n) => n.type);
    const clearAll = () =>
        prisma.notification.deleteMany({
            where: { userId: { in: [client.user.id, freelancer.user.id, other.user.id] } },
        });

    const createIssue = (user, body = {}) =>
        request(app)
            .post(`/api/contracts/${contract.id}/issues`)
            .set(auth(user.token))
            .send({ title: 'Design task', ...body });

    const updateIssue = (user, issueId, body) =>
        request(app).patch(`/api/issues/${issueId}`).set(auth(user.token)).send(body);

    const comment = (user, issueId, body) =>
        request(app).post(`/api/issues/${issueId}/comments`).set(auth(user.token)).send({ body });

    beforeAll(async () => {
        await cleanUpUsers(emails);
        client = await registerUser({ email: emails[0], password: PASSWORD, fullName: 'Ntfi Client', role: 'CLIENT' });
        freelancer = await registerUser({ email: emails[1], password: PASSWORD, fullName: 'Ntfi Freelancer', role: 'FREELANCER' });
        other = await registerUser({ email: emails[2], password: PASSWORD, fullName: 'Ntfi Other', role: 'FREELANCER' });

        const job = await createJob(client.token, { title: 'Task notification job', budget: 500 });
        const proposal = await createProposal(freelancer.token, job.id, { bidAmount: 400 });
        const offer = await request(app).post('/api/contracts').set(auth(client.token)).send({ proposalId: proposal.id });
        expect(offer.status).toBe(201);
        const accepted = await request(app)
            .patch(`/api/contracts/${offer.body.contract.id}/accept`)
            .set(auth(freelancer.token));
        expect(accepted.status).toBe(200);
        contract = accepted.body.contract;
    });

    afterAll(async () => {
        await cleanUpUsers(emails);
        await prisma.$disconnect();
    });

    beforeEach(clearAll);

    describe('assignment', () => {
        it('tells the assignee when a task is created for them, with a link to the board', async () => {
            const res = await createIssue(client, { assigneeId: freelancer.user.id });
            expect(res.status).toBe(201);

            const received = await notes(freelancer);
            expect(received).toHaveLength(1);
            expect(received[0].type).toBe('ISSUE_ASSIGNED');
            expect(received[0].body).toContain('Ntfi Client');
            expect(received[0].body).toContain('Design task');
            expect(received[0].link).toBe(`/contracts/${contract.id}`);
            expect(received[0].data.issueId).toBe(res.body.issue.id);

            // Təyin edənə bildiriş getmir
            expect(await types(client)).toEqual([]);
        });

        it('does not notify for an unassigned task or when you assign yourself', async () => {
            await createIssue(client);
            await createIssue(client, { assigneeId: client.user.id });

            expect(await types(client)).toEqual([]);
            expect(await types(freelancer)).toEqual([]);
        });

        it('notifies on reassignment only when the assignee actually changes', async () => {
            const created = await createIssue(freelancer);
            const issueId = created.body.issue.id;
            expect(await types(client)).toEqual([]);

            await updateIssue(freelancer, issueId, { assigneeId: client.user.id });
            expect(await types(client)).toEqual(['ISSUE_ASSIGNED']);

            // Eyni şəxs təkrar təyin olunur və ya başqa sahə dəyişir: yeni bildiriş yoxdur
            await updateIssue(freelancer, issueId, { assigneeId: client.user.id });
            await updateIssue(freelancer, issueId, { title: 'Renamed task' });
            expect(await types(client)).toEqual(['ISSUE_ASSIGNED']);
        });

        it('does not notify anyone when the assignee is not a participant of the contract', async () => {
            const res = await createIssue(client, { assigneeId: other.user.id });
            expect(res.status).toBe(400);

            expect(await types(other)).toEqual([]);
            expect(await types(freelancer)).toEqual([]);
        });
    });

    describe('comments', () => {
        it('tells the other party about a comment, with a short excerpt', async () => {
            const issue = (await createIssue(client)).body.issue;
            await clearAll();

            const long = `${'Please check the colours. '.repeat(12)}`.trim(); // 300+ simvol
            const res = await comment(freelancer, issue.id, long);
            expect(res.status).toBe(201);

            const received = await notes(client);
            expect(received).toHaveLength(1);
            expect(received[0].type).toBe('COMMENT_ADDED');
            expect(received[0].body).toContain('Ntfi Freelancer');
            expect(received[0].body).toContain('Design task');
            expect(received[0].body.endsWith('…')).toBe(true);
            expect(received[0].body.length).toBeLessThan(long.length);
            expect(received[0].link).toBe(`/contracts/${contract.id}`);
            expect(received[0].data.commentId).toBe(res.body.comment.id);

            // Yazan öz şərhi üçün bildiriş almır
            expect(await types(freelancer)).toEqual([]);
        });

        it('keeps a short comment whole', async () => {
            const issue = (await createIssue(client)).body.issue;
            await clearAll();

            await comment(client, issue.id, 'Looks good to me');

            const received = await notes(freelancer);
            expect(received).toHaveLength(1);
            expect(received[0].body).toContain('Looks good to me');
            expect(received[0].body.endsWith('…')).toBe(false);
        });

        it('does not notify anyone when the comment is rejected', async () => {
            const issue = (await createIssue(client)).body.issue;
            await clearAll();

            const res = await comment(other, issue.id, 'I should not be able to write here');
            expect(res.status).toBe(403);

            expect(await types(client)).toEqual([]);
            expect(await types(freelancer)).toEqual([]);
            expect(await types(other)).toEqual([]);
        });
    });
});
