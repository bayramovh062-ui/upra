import request from 'supertest';
import { app, prisma, auth, cleanUpUsers, registerUser, createJob, createProposal } from './helpers/db.js';

const PASSWORD = 'Password123!';
const emails = ['chat_client@upra.com', 'chat_free@upra.com', 'chat_free2@upra.com', 'chat_client2@upra.com'];
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

// P1: client və frilanser arasında daimi söhbət
describe('Chat', () => {
    let client; // chat_client: frilanserə (free) iş açıb, təklif alıb
    let freelancer;
    let stranger; // chat_free2: client-lə heç bir əlaqəsi yoxdur
    let otherClient; // chat_client2: free ilə əlaqəsi yoxdur

    const open = (user, userId) => request(app).post('/api/conversations').set(auth(user.token)).send({ userId });
    const send = (user, conversationId, body) =>
        request(app).post(`/api/conversations/${conversationId}/messages`).set(auth(user.token)).send({ body });
    const messages = (user, conversationId, query = '') =>
        request(app).get(`/api/conversations/${conversationId}/messages${query}`).set(auth(user.token));
    const list = (user) => request(app).get('/api/conversations').set(auth(user.token));
    const unread = async (user) =>
        (await request(app).get('/api/conversations/unread-count').set(auth(user.token))).body.unreadCount;

    const ours = () => ({ OR: [{ clientId: client.user.id }, { clientId: otherClient.user.id }] });

    const resetChat = async () => {
        await prisma.message.deleteMany({ where: { conversation: ours() } });
        await prisma.conversation.deleteMany({ where: ours() });
    };

    beforeAll(async () => {
        await cleanUpUsers(emails);
        client = await registerUser({ email: emails[0], password: PASSWORD, fullName: 'Chat Client', role: 'CLIENT' });
        freelancer = await registerUser({ email: emails[1], password: PASSWORD, fullName: 'Chat Freelancer', role: 'FREELANCER' });
        stranger = await registerUser({ email: emails[2], password: PASSWORD, fullName: 'Chat Stranger', role: 'FREELANCER' });
        otherClient = await registerUser({ email: emails[3], password: PASSWORD, fullName: 'Chat Client Two', role: 'CLIENT' });

        const job = await createJob(client.token, { title: 'Chat relationship job' });
        await createProposal(freelancer.token, job.id);
    });

    afterAll(async () => {
        await cleanUpUsers(emails);
        await prisma.$disconnect();
    });

    beforeEach(resetChat);

    describe('opening a conversation', () => {
        it('requires authentication', async () => {
            expect((await request(app).get('/api/conversations')).status).toBe(401);
            expect((await request(app).post('/api/conversations').send({ userId: freelancer.user.id })).status).toBe(401);
            expect((await request(app).get('/api/conversations/unread-count')).status).toBe(401);
        });

        it('lets the client open it, then returns the same conversation for the freelancer', async () => {
            const first = await open(client, freelancer.user.id);
            expect(first.status).toBe(201);
            expect(first.body.conversation.otherUser.id).toBe(freelancer.user.id);
            expect(first.body.conversation.otherUser.fullName).toBe('Chat Freelancer');

            const again = await open(client, freelancer.user.id);
            expect(again.status).toBe(200);
            expect(again.body.conversation.id).toBe(first.body.conversation.id);

            const fromFreelancer = await open(freelancer, client.user.id);
            expect(fromFreelancer.status).toBe(200);
            expect(fromFreelancer.body.conversation.id).toBe(first.body.conversation.id);
            expect(fromFreelancer.body.conversation.otherUser.id).toBe(client.user.id);

            // Bir cüt üçün yalnız bir söhbət
            expect(await prisma.conversation.count({ where: { clientId: client.user.id, freelancerId: freelancer.user.id } })).toBe(1);
        });

        it('creates exactly one conversation when both parties open it at the same time', async () => {
            const [a, b] = await Promise.all([open(client, freelancer.user.id), open(freelancer, client.user.id)]);
            expect([200, 201]).toContain(a.status);
            expect([200, 201]).toContain(b.status);
            expect(a.body.conversation.id).toBe(b.body.conversation.id);
            expect(await prisma.conversation.count({ where: { clientId: client.user.id, freelancerId: freelancer.user.id } })).toBe(1);
        });

        it('refuses people without a proposal or contract between them (403)', async () => {
            expect((await open(client, stranger.user.id)).status).toBe(403);
            expect((await open(stranger, client.user.id)).status).toBe(403);
            expect((await open(otherClient, freelancer.user.id)).status).toBe(403);
            expect(await prisma.conversation.count({ where: ours() })).toBe(0);
        });

        it('rejects yourself, same role, unknown users and invalid ids', async () => {
            expect((await open(client, client.user.id)).status).toBe(400);
            expect((await open(freelancer, stranger.user.id)).status).toBe(400); // iki frilanser
            expect((await open(client, otherClient.user.id)).status).toBe(400); // iki client
            expect((await open(client, MISSING_ID)).status).toBe(404);
            expect((await open(client, 'not-a-uuid')).status).toBe(400);
            expect((await request(app).post('/api/conversations').set(auth(client.token)).send({})).status).toBe(400);
        });

        it('cannot be opened with a deleted account', async () => {
            await prisma.user.update({ where: { id: freelancer.user.id }, data: { deletedAt: new Date() } });
            try {
                expect((await open(client, freelancer.user.id)).status).toBe(404);
            } finally {
                await prisma.user.update({ where: { id: freelancer.user.id }, data: { deletedAt: null } });
            }
        });
    });

    describe('messages', () => {
        let conversationId;

        beforeEach(async () => {
            conversationId = (await open(client, freelancer.user.id)).body.conversation.id;
        });

        it('sends messages both ways and returns them oldest first', async () => {
            expect((await send(client, conversationId, 'Hello there')).status).toBe(201);
            expect((await send(freelancer, conversationId, 'Hi, happy to help')).status).toBe(201);
            expect((await send(client, conversationId, 'Great, lets talk scope')).status).toBe(201);

            const res = await messages(freelancer, conversationId);
            expect(res.status).toBe(200);
            expect(res.body.hasMore).toBe(false);
            expect(res.body.messages.map((m) => m.body)).toEqual([
                'Hello there',
                'Hi, happy to help',
                'Great, lets talk scope',
            ]);
            expect(res.body.messages[0].senderId).toBe(client.user.id);
        });

        it('trims messages and rejects empty, whitespace-only and too long ones', async () => {
            const ok = await send(client, conversationId, '   padded message   ');
            expect(ok.status).toBe(201);
            expect(ok.body.message.body).toBe('padded message');

            expect((await send(client, conversationId, '')).status).toBe(400);
            expect((await send(client, conversationId, '     ')).status).toBe(400);
            expect((await send(client, conversationId, 'x'.repeat(2001))).status).toBe(400);
            expect((await send(client, conversationId, 'x'.repeat(2000))).status).toBe(201);
            expect((await request(app).post(`/api/conversations/${conversationId}/messages`).set(auth(client.token)).send({})).status).toBe(400);
        });

        it('hides the conversation from everyone who is not a participant (404)', async () => {
            await send(client, conversationId, 'Private');

            expect((await messages(stranger, conversationId)).status).toBe(404);
            expect((await send(stranger, conversationId, 'Intruder')).status).toBe(404);
            expect((await request(app).get(`/api/conversations/${conversationId}`).set(auth(stranger.token))).status).toBe(404);
            expect((await request(app).patch(`/api/conversations/${conversationId}/read`).set(auth(stranger.token))).status).toBe(404);
            expect((await messages(client, MISSING_ID)).status).toBe(404);
            expect((await list(stranger)).body.conversations).toEqual([]);
            expect(await prisma.message.count({ where: { conversationId } })).toBe(1);
        });

        it('pages through older messages with the before cursor', async () => {
            for (let i = 1; i <= 5; i += 1) {
                await send(i % 2 ? client : freelancer, conversationId, `Message ${i}`);
            }

            const latest = await messages(client, conversationId, '?limit=2');
            expect(latest.body.messages.map((m) => m.body)).toEqual(['Message 4', 'Message 5']);
            expect(latest.body.hasMore).toBe(true);

            const older = await messages(client, conversationId, `?limit=2&before=${latest.body.messages[0].id}`);
            expect(older.body.messages.map((m) => m.body)).toEqual(['Message 2', 'Message 3']);
            expect(older.body.hasMore).toBe(true);

            const oldest = await messages(client, conversationId, `?limit=2&before=${older.body.messages[0].id}`);
            expect(oldest.body.messages.map((m) => m.body)).toEqual(['Message 1']);
            expect(oldest.body.hasMore).toBe(false);

            expect((await messages(client, conversationId, `?before=${MISSING_ID}`)).status).toBe(400);
            expect((await messages(client, conversationId, '?limit=abc')).status).toBe(200);
        });

        it('keeps working after the contract is over: the same conversation continues', async () => {
            await send(client, conversationId, 'Before the contract');
            const job = await createJob(client.token, { title: 'Second job for the same pair' });
            await createProposal(freelancer.token, job.id);

            const again = await open(client, freelancer.user.id);
            expect(again.body.conversation.id).toBe(conversationId);
            expect((await messages(freelancer, conversationId)).body.messages).toHaveLength(1);
        });

        it('stays readable but refuses new messages once the other account is deleted', async () => {
            await send(client, conversationId, 'Still here');
            await prisma.user.update({ where: { id: freelancer.user.id }, data: { deletedAt: new Date() } });
            try {
                const blocked = await send(client, conversationId, 'Anyone there?');
                expect(blocked.status).toBe(403);
                expect(await prisma.message.count({ where: { conversationId } })).toBe(1);

                const history = await messages(client, conversationId);
                expect(history.status).toBe(200);
                expect(history.body.messages).toHaveLength(1);
            } finally {
                await prisma.user.update({ where: { id: freelancer.user.id }, data: { deletedAt: null } });
            }
        });
    });

    describe('conversation list and unread counts', () => {
        let conversationId;

        beforeEach(async () => {
            conversationId = (await open(client, freelancer.user.id)).body.conversation.id;
        });

        it('hides a conversation until the first message is sent', async () => {
            expect((await list(client)).body.conversations).toEqual([]);
            expect((await list(freelancer)).body.conversations).toEqual([]);

            await send(client, conversationId, 'First!');
            expect((await list(client)).body.conversations).toHaveLength(1);
            expect((await list(freelancer)).body.conversations).toHaveLength(1);
        });

        it('shows the last message, the other person and the unread count to each side', async () => {
            await send(client, conversationId, 'One');
            await send(client, conversationId, 'Two');

            const forFreelancer = (await list(freelancer)).body.conversations[0];
            expect(forFreelancer.otherUser.id).toBe(client.user.id);
            expect(forFreelancer.lastMessage.body).toBe('Two');
            expect(forFreelancer.unreadCount).toBe(2);

            // Yazan öz mesajlarını oxunmamış saymır
            const forClient = (await list(client)).body.conversations[0];
            expect(forClient.otherUser.id).toBe(freelancer.user.id);
            expect(forClient.unreadCount).toBe(0);
            expect(await unread(client)).toBe(0);
            expect(await unread(freelancer)).toBe(2);
        });

        it('marks a conversation read, idempotently, and starts counting again for new messages', async () => {
            await send(client, conversationId, 'One');
            await send(client, conversationId, 'Two');

            const read = await request(app).patch(`/api/conversations/${conversationId}/read`).set(auth(freelancer.token));
            expect(read.status).toBe(200);
            expect(read.body.unreadCount).toBe(0);
            expect((await request(app).patch(`/api/conversations/${conversationId}/read`).set(auth(freelancer.token))).status).toBe(200);
            expect(await unread(freelancer)).toBe(0);

            await new Promise((resolve) => setTimeout(resolve, 5));
            await send(client, conversationId, 'Three');
            expect(await unread(freelancer)).toBe(1);

            // Freelancer cavab yazanda öz tərəfi oxunmuş sayılır
            await send(freelancer, conversationId, 'Got it');
            expect(await unread(freelancer)).toBe(0);
            expect(await unread(client)).toBe(1);
        });

        it('orders conversations by latest activity and sums unread across them', async () => {
            const job = await createJob(otherClient.token, { title: 'Other pair job' });
            await createProposal(freelancer.token, job.id);
            const second = (await open(otherClient, freelancer.user.id)).body.conversation.id;

            await send(client, conversationId, 'Older conversation');
            await new Promise((resolve) => setTimeout(resolve, 5));
            await send(otherClient, second, 'Newer conversation');

            const conversations = (await list(freelancer)).body.conversations;
            expect(conversations.map((c) => c.id)).toEqual([second, conversationId]);
            expect(await unread(freelancer)).toBe(2);
        });
    });
});
