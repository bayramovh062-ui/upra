import request from 'supertest';
import {
    app,
    prisma,
    auth,
    cleanUpUsers,
    cleanUpTestSkills,
    registerUser,
    createJob,
} from './helpers/db.js';

const PASSWORD = 'Password123!';
const MISSING_ID = '00000000-0000-0000-0000-000000000000';
const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (n) => new Date(Date.now() + n * DAY_MS).toISOString();
const titles = (res) => res.body.jobs.map((j) => j.title).sort();
const skillNames = (job) => job.skills.map((s) => s.name);

// Bütün test faylları eyni bazada PARALEL işləyir, ona görə hər sorğu yalnız bu faylın
// "ZZ..." başlıqlı işləri ilə məhdudlaşdırılır və bacarıq adları "zz-" ilə başlayır.
describe('Phase 1A: taxonomy, job fields, drafts, saved jobs, skills profile', () => {
    const emails = [
        'tx_client@upra.com',
        'tx_client2@upra.com',
        'tx_free@upra.com',
        'tx_free2@upra.com',
    ];
    let client, client2, free, free2;

    beforeAll(async () => {
        await cleanUpUsers(emails);
        await cleanUpTestSkills();

        client = await registerUser({ email: emails[0], password: PASSWORD, fullName: 'TX Client', role: 'CLIENT' });
        client2 = await registerUser({ email: emails[1], password: PASSWORD, fullName: 'TX Client Two', role: 'CLIENT' });
        free = await registerUser({ email: emails[2], password: PASSWORD, fullName: 'TX Freelancer', role: 'FREELANCER' });
        free2 = await registerUser({ email: emails[3], password: PASSWORD, fullName: 'TX Freelancer Two', role: 'FREELANCER' });
    });

    afterAll(async () => {
        await cleanUpUsers(emails);
        await cleanUpTestSkills();
        await prisma.$disconnect();
    });

    // -----------------------------------------------------------------------
    describe('GET /api/categories and /api/skills', () => {
        it('lists the seeded categories publicly, with open job counts', async () => {
            const res = await request(app).get('/api/categories');

            expect(res.status).toBe(200);
            const slugs = res.body.categories.map((c) => c.slug);
            expect(slugs).toEqual(expect.arrayContaining(['fullstack-development', 'devops-cloud', 'ui-ux-product-design']));
            res.body.categories.forEach((c) => expect(typeof c.openJobs).toBe('number'));
        });

        it('searches skills by name (case-insensitive) and respects the limit', async () => {
            const res = await request(app).get('/api/skills?search=REACT');

            expect(res.status).toBe(200);
            expect(res.body.skills.map((s) => s.slug)).toEqual(expect.arrayContaining(['react', 'react native']));

            const limited = await request(app).get('/api/skills?limit=3');
            expect(limited.body.skills).toHaveLength(3);
        });
    });

    // -----------------------------------------------------------------------
    describe('POST/PATCH /api/jobs with the new fields', () => {
        let categoryId;

        beforeAll(async () => {
            const cat = await prisma.category.findUnique({ where: { slug: 'fullstack-development' } });
            categoryId = cat.id;
        });

        it('creates a job with category, level, structure, deadline and skills', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .set(auth(client.token))
                .send({
                    title: 'ZZCreate full job',
                    description: 'A sufficiently long description for the test job post.',
                    budget: 3000,
                    categoryId,
                    experienceLevel: 'SENIOR',
                    paymentStructure: 'LUMP_SUM',
                    deadline: daysFromNow(10),
                    skills: ['zz-alpha', 'zz-beta'],
                });

            expect(res.status).toBe(201);
            expect(res.body.job.status).toBe('OPEN');
            expect(res.body.job.category.slug).toBe('fullstack-development');
            expect(res.body.job.experienceLevel).toBe('SENIOR');
            expect(res.body.job.paymentStructure).toBe('LUMP_SUM');
            expect(res.body.job.deadline).toBeTruthy();
            expect(skillNames(res.body.job)).toEqual(['zz-alpha', 'zz-beta']);
        });

        it('defaults to MILESTONES and no skills when the new fields are omitted', async () => {
            const job = await createJob(client.token, { title: 'ZZCreate minimal job' });

            expect(job.paymentStructure).toBe('MILESTONES');
            expect(job.skills).toEqual([]);
            expect(job.category).toBeNull();
        });

        it('rejects an unknown category', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .set(auth(client.token))
                .send({
                    title: 'ZZCreate bad category',
                    description: 'A sufficiently long description for the test job post.',
                    budget: 100,
                    categoryId: MISSING_ID,
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/category not found/i);
        });

        it('rejects invalid skill names and more than 8 skills', async () => {
            const bad = await request(app)
                .post('/api/jobs')
                .set(auth(client.token))
                .send({
                    title: 'ZZCreate bad skill',
                    description: 'A sufficiently long description for the test job post.',
                    budget: 100,
                    skills: ['bad,name'],
                });
            expect(bad.status).toBe(400);
            expect(bad.body.message).toMatch(/skill names/i);

            const many = await request(app)
                .post('/api/jobs')
                .set(auth(client.token))
                .send({
                    title: 'ZZCreate too many skills',
                    description: 'A sufficiently long description for the test job post.',
                    budget: 100,
                    skills: Array.from({ length: 9 }, (_, i) => `zz-many-${i}`),
                });
            expect(many.status).toBe(400);
            expect(many.body.message).toMatch(/at most 8/i);
        });

        it('rejects bad enum values', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .set(auth(client.token))
                .send({
                    title: 'ZZCreate bad enum',
                    description: 'A sufficiently long description for the test job post.',
                    budget: 100,
                    experienceLevel: 'GOD',
                });
            expect(res.status).toBe(400);
        });

        it('requires the deadline to be at least 7 days away', async () => {
            const soon = await request(app)
                .post('/api/jobs')
                .set(auth(client.token))
                .send({
                    title: 'ZZCreate soon deadline',
                    description: 'A sufficiently long description for the test job post.',
                    budget: 100,
                    deadline: daysFromNow(3),
                });
            expect(soon.status).toBe(400);
            expect(soon.body.message).toMatch(/at least 7 days/i);

            const garbage = await request(app)
                .post('/api/jobs')
                .set(auth(client.token))
                .send({
                    title: 'ZZCreate garbage deadline',
                    description: 'A sufficiently long description for the test job post.',
                    budget: 100,
                    deadline: 'next friday',
                });
            expect(garbage.status).toBe(400);
        });

        it('treats skills as case-insensitive and removes duplicates', async () => {
            const job = await createJob(client.token, {
                title: 'ZZCreate duplicate skills',
                skills: ['ZZ-Dup', 'zz-dup', '  zz-dup  '],
            });

            expect(job.skills).toHaveLength(1);
            expect(job.skills[0].slug).toBe('zz-dup');
        });

        it('replaces skills on update and clears them with an empty array', async () => {
            const job = await createJob(client.token, { title: 'ZZUpdate skills job', skills: ['zz-one', 'zz-two'] });

            const swap = await request(app)
                .patch(`/api/jobs/${job.id}`)
                .set(auth(client.token))
                .send({ skills: ['zz-two', 'zz-three'] });
            expect(swap.status).toBe(200);
            expect(skillNames(swap.body.job)).toEqual(['zz-three', 'zz-two']);

            const clear = await request(app)
                .patch(`/api/jobs/${job.id}`)
                .set(auth(client.token))
                .send({ skills: [] });
            expect(clear.status).toBe(200);
            expect(clear.body.job.skills).toEqual([]);
        });

        it('updates and clears the deadline, validating it again', async () => {
            const job = await createJob(client.token, { title: 'ZZUpdate deadline job', deadline: daysFromNow(10) });

            const tooSoon = await request(app)
                .patch(`/api/jobs/${job.id}`)
                .set(auth(client.token))
                .send({ deadline: daysFromNow(2) });
            expect(tooSoon.status).toBe(400);

            const cleared = await request(app)
                .patch(`/api/jobs/${job.id}`)
                .set(auth(client.token))
                .send({ deadline: null });
            expect(cleared.status).toBe(200);
            expect(cleared.body.job.deadline).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    describe('drafts', () => {
        let draft;

        beforeAll(async () => {
            const res = await request(app)
                .post('/api/jobs')
                .set(auth(client.token))
                .send({
                    title: 'ZZDraft private job',
                    description: 'A sufficiently long description for the test job post.',
                    budget: 700,
                    status: 'DRAFT',
                    deadline: daysFromNow(10),
                });
            expect(res.status).toBe(201);
            draft = res.body.job;
        });

        it('creates the job as DRAFT', () => {
            expect(draft.status).toBe('DRAFT');
        });

        it('hides the draft from the public list and from other users', async () => {
            const anon = await request(app).get('/api/jobs?search=ZZDraft');
            expect(anon.body.jobs).toHaveLength(0);

            const asFreelancer = await request(app).get(`/api/jobs/${draft.id}`).set(auth(free.token));
            expect(asFreelancer.status).toBe(404);

            const asOtherClient = await request(app).get(`/api/jobs/${draft.id}`).set(auth(client2.token));
            expect(asOtherClient.status).toBe(404);
        });

        it('shows the draft to its owner, in GET /jobs/:id and in My jobs', async () => {
            const detail = await request(app).get(`/api/jobs/${draft.id}`).set(auth(client.token));
            expect(detail.status).toBe(200);
            expect(detail.body.job.status).toBe('DRAFT');

            const mine = await request(app).get('/api/jobs/my?status=DRAFT').set(auth(client.token));
            expect(mine.status).toBe(200);
            expect(mine.body.jobs.map((j) => j.id)).toContain(draft.id);
            mine.body.jobs.forEach((j) => expect(j.status).toBe('DRAFT'));
        });

        it('does not accept proposals or saves on a draft', async () => {
            const proposal = await request(app)
                .post('/api/proposals')
                .set(auth(free.token))
                .send({
                    jobPostId: draft.id,
                    coverLetter: 'This is a cover letter that is long enough to pass validation.',
                    bidAmount: 500,
                });
            expect(proposal.status).toBe(400);

            const save = await request(app).post(`/api/jobs/${draft.id}/save`).set(auth(free.token));
            expect(save.status).toBe(404);
        });

        it('lets the owner edit the draft', async () => {
            const res = await request(app)
                .patch(`/api/jobs/${draft.id}`)
                .set(auth(client.token))
                .send({ title: 'ZZDraft edited job' });

            expect(res.status).toBe(200);
            expect(res.body.job.status).toBe('DRAFT');
            expect(res.body.job.title).toBe('ZZDraft edited job');
        });

        it('only the owner can publish, and a stale deadline blocks publishing', async () => {
            const other = await request(app).post(`/api/jobs/${draft.id}/publish`).set(auth(client2.token));
            expect(other.status).toBe(403);

            const byFreelancer = await request(app).post(`/api/jobs/${draft.id}/publish`).set(auth(free.token));
            expect(byFreelancer.status).toBe(403);

            await prisma.jobPost.update({ where: { id: draft.id }, data: { deadline: new Date(Date.now() - DAY_MS) } });
            const stale = await request(app).post(`/api/jobs/${draft.id}/publish`).set(auth(client.token));
            expect(stale.status).toBe(400);
            expect(stale.body.message).toMatch(/deadline has already passed/i);

            await prisma.jobPost.update({ where: { id: draft.id }, data: { deadline: null } });
        });

        it('publishes the draft: it becomes OPEN and visible, and cannot be published twice', async () => {
            const res = await request(app).post(`/api/jobs/${draft.id}/publish`).set(auth(client.token));
            expect(res.status).toBe(200);
            expect(res.body.job.status).toBe('OPEN');

            const list = await request(app).get('/api/jobs?search=ZZDraft');
            expect(list.body.jobs.map((j) => j.id)).toContain(draft.id);

            const again = await request(app).post(`/api/jobs/${draft.id}/publish`).set(auth(client.token));
            expect(again.status).toBe(400);
        });

        it('soft-deletes both a draft and an open job: nothing is removed, status becomes CANCELLED', async () => {
            const d = await request(app)
                .post('/api/jobs')
                .set(auth(client.token))
                .send({
                    title: 'ZZDraft to delete',
                    description: 'A sufficiently long description for the test job post.',
                    budget: 100,
                    status: 'DRAFT',
                });
            const del = await request(app).delete(`/api/jobs/${d.body.job.id}`).set(auth(client.token));
            expect(del.status).toBe(200);
            const storedDraft = await prisma.jobPost.findUnique({ where: { id: d.body.job.id } });
            expect(storedDraft).not.toBeNull();
            expect(storedDraft.status).toBe('CANCELLED');

            const cancel = await request(app).delete(`/api/jobs/${draft.id}`).set(auth(client.token));
            expect(cancel.status).toBe(200);
            const stored = await prisma.jobPost.findUnique({ where: { id: draft.id } });
            expect(stored.status).toBe('CANCELLED');
        });
    });

    // -----------------------------------------------------------------------
    describe('GET /api/jobs filters', () => {
        let j1, j2, j3, j4, j5;

        beforeAll(async () => {
            const cats = Object.fromEntries(
                (await prisma.category.findMany()).map((c) => [c.slug, c.id])
            );

            j1 = await createJob(client.token, {
                title: 'ZZFilter one', budget: 5000, categoryId: cats['fullstack-development'],
                experienceLevel: 'SENIOR', skills: ['zz-alpha', 'zz-beta'],
            });
            j2 = await createJob(client.token, {
                title: 'ZZFilter two', budget: 800, categoryId: cats['frontend-development'],
                experienceLevel: 'ENTRY', skills: ['zz-beta'],
            });
            j3 = await createJob(client.token, {
                title: 'ZZFilter three', budget: 2500, experienceLevel: 'MID',
                paymentStructure: 'LUMP_SUM', skills: ['zz-gamma'],
            });
            j4 = await createJob(client.token, {
                title: 'Plain title job four', budget: 1200, skills: ['zz-delta'],
            });
            j5 = await createJob(client.token, {
                title: 'ZZFilter five', budget: 3000, categoryId: cats['backend-systems'],
                experienceLevel: 'MID', skills: ['zz-alpha', 'zz-gamma'],
            });
        });

        const list = (qs) => request(app).get(`/api/jobs?search=ZZFilter&${qs}`);

        it('works without a token and does not leak per-user fields', async () => {
            const res = await list('');
            expect(res.status).toBe(200);
            expect(titles(res)).toEqual(['ZZFilter five', 'ZZFilter one', 'ZZFilter three', 'ZZFilter two']);
            res.body.jobs.forEach((j) => {
                expect(j.isSaved).toBeUndefined();
                expect(j.matchScore).toBeUndefined();
                expect(j.skills.length).toBeGreaterThan(0);
            });
            expect(res.body.tabCounts).toBeUndefined();
        });

        it('filters by one or several categories (slug)', async () => {
            expect(titles(await list('category=fullstack-development'))).toEqual(['ZZFilter one']);
            expect(titles(await list('category=fullstack-development,frontend-development'))).toEqual([
                'ZZFilter one',
                'ZZFilter two',
            ]);
        });

        it('filters by experience level, ignoring case and unknown values', async () => {
            expect(titles(await list('experienceLevel=senior,entry'))).toEqual(['ZZFilter one', 'ZZFilter two']);
            expect(titles(await list('experienceLevel=MID,nonsense'))).toEqual(['ZZFilter five', 'ZZFilter three']);
        });

        it('filters by skills: any by default, all with skillsMode=all', async () => {
            expect(titles(await list('skills=zz-beta'))).toEqual(['ZZFilter one', 'ZZFilter two']);
            expect(titles(await list('skills=zz-alpha,zz-gamma'))).toEqual([
                'ZZFilter five',
                'ZZFilter one',
                'ZZFilter three',
            ]);
            expect(titles(await list('skills=zz-alpha,zz-beta&skillsMode=all'))).toEqual(['ZZFilter one']);
            expect(titles(await list('skills=ZZ-Alpha&skills=zz-beta&skillsMode=all'))).toEqual(['ZZFilter one']);
        });

        it('filters by budget range and payment structure', async () => {
            expect(titles(await list('minBudget=1000&maxBudget=3000'))).toEqual(['ZZFilter five', 'ZZFilter three']);
            expect(titles(await list('paymentStructure=lump_sum'))).toEqual(['ZZFilter three']);
        });

        it('combines filters with AND', async () => {
            expect(titles(await list('experienceLevel=MID&skills=zz-gamma&minBudget=2800'))).toEqual(['ZZFilter five']);
            expect(titles(await list('category=devops-cloud&skills=zz-beta'))).toEqual([]);
        });

        it('searches inside skill names too', async () => {
            const res = await request(app).get('/api/jobs?search=zz-delta');
            expect(res.body.jobs.map((j) => j.id)).toEqual([j4.id]);
        });

        it('sorts by budget and exposes the category and proposal count', async () => {
            const asc = await list('sort=budget_asc');
            expect(asc.body.jobs.map((j) => Number(j.budget))).toEqual([800, 2500, 3000, 5000]);

            const desc = await list('sort=budget_desc');
            expect(desc.body.jobs.map((j) => Number(j.budget))).toEqual([5000, 3000, 2500, 800]);

            const first = desc.body.jobs[0];
            expect(first.category.slug).toBe('fullstack-development');
            expect(first._count.proposals).toBe(0);
        });

        it('keeps pagination working together with filters', async () => {
            const res = await list('sort=budget_asc&limit=2&page=2');
            expect(res.body.pagination.total).toBe(4);
            expect(res.body.pagination.totalPages).toBe(2);
            expect(titles(res)).toEqual(['ZZFilter five', 'ZZFilter one']);
        });

        it('hides cancelled jobs', async () => {
            const gone = await createJob(client.token, { title: 'ZZFilter cancelled', skills: ['zz-alpha'] });
            await request(app).delete(`/api/jobs/${gone.id}`).set(auth(client.token));

            const res = await list('');
            expect(titles(res)).not.toContain('ZZFilter cancelled');
        });

        // ---------------------------------------------------------------
        describe('saved jobs', () => {
            it('only freelancers can save or unsave', async () => {
                const save = await request(app).post(`/api/jobs/${j1.id}/save`).set(auth(client.token));
                expect(save.status).toBe(403);

                const anon = await request(app).post(`/api/jobs/${j1.id}/save`);
                expect(anon.status).toBe(401);

                const unsave = await request(app).delete(`/api/jobs/${j1.id}/save`).set(auth(client.token));
                expect(unsave.status).toBe(403);
            });

            it('returns 404 for an unknown job and 400 for a job that is not open', async () => {
                const missing = await request(app).post(`/api/jobs/${MISSING_ID}/save`).set(auth(free.token));
                expect(missing.status).toBe(404);

                const closed = await createJob(client.token, { title: 'ZZSaved closed job' });
                await prisma.jobPost.update({ where: { id: closed.id }, data: { status: 'IN_PROGRESS' } });
                const res = await request(app).post(`/api/jobs/${closed.id}/save`).set(auth(free.token));
                expect(res.status).toBe(400);
            });

            it('saves a job idempotently and lists it in the saved tab with isSaved and counts', async () => {
                const first = await request(app).post(`/api/jobs/${j1.id}/save`).set(auth(free.token));
                expect(first.status).toBe(200);
                expect(first.body.saved).toBe(true);

                const second = await request(app).post(`/api/jobs/${j1.id}/save`).set(auth(free.token));
                expect(second.status).toBe(200);
                expect(await prisma.savedJob.count({ where: { userId: free.user.id } })).toBe(1);

                const tab = await request(app).get('/api/jobs?tab=saved').set(auth(free.token));
                expect(tab.status).toBe(200);
                expect(tab.body.jobs.map((j) => j.id)).toEqual([j1.id]);
                expect(tab.body.jobs[0].isSaved).toBe(true);
                expect(tab.body.tabCounts.saved).toBe(1);

                const alias = await request(app).get('/api/jobs/saved').set(auth(free.token));
                expect(alias.body.jobs.map((j) => j.id)).toEqual([j1.id]);
            });

            it('marks isSaved correctly in the normal list', async () => {
                const res = await request(app).get('/api/jobs?search=ZZFilter').set(auth(free.token));
                const byTitle = Object.fromEntries(res.body.jobs.map((j) => [j.title, j.isSaved]));
                expect(byTitle['ZZFilter one']).toBe(true);
                expect(byTitle['ZZFilter two']).toBe(false);

                const other = await request(app).get('/api/jobs?search=ZZFilter').set(auth(free2.token));
                other.body.jobs.forEach((j) => expect(j.isSaved).toBe(false));
            });

            it('rejects the saved tab for anonymous users and clients', async () => {
                const anon = await request(app).get('/api/jobs?tab=saved');
                expect(anon.status).toBe(401);

                const asClient = await request(app).get('/api/jobs?tab=saved').set(auth(client.token));
                expect(asClient.status).toBe(403);

                const clientRoute = await request(app).get('/api/jobs/saved').set(auth(client.token));
                expect(clientRoute.status).toBe(403);
            });

            it('drops a cancelled job from the saved tab and unsaves idempotently', async () => {
                const extra = await createJob(client.token, { title: 'ZZSaved extra job' });
                await request(app).post(`/api/jobs/${extra.id}/save`).set(auth(free.token));
                await request(app).delete(`/api/jobs/${extra.id}`).set(auth(client.token));

                const tab = await request(app).get('/api/jobs?tab=saved').set(auth(free.token));
                expect(tab.body.jobs.map((j) => j.id)).toEqual([j1.id]);

                const un1 = await request(app).delete(`/api/jobs/${j1.id}/save`).set(auth(free.token));
                const un2 = await request(app).delete(`/api/jobs/${j1.id}/save`).set(auth(free.token));
                expect(un1.status).toBe(200);
                expect(un2.status).toBe(200);
                expect(un2.body.saved).toBe(false);

                const empty = await request(app).get('/api/jobs?tab=saved').set(auth(free.token));
                expect(empty.body.jobs).toEqual([]);
            });
        });

        // ---------------------------------------------------------------
        describe('freelancer skills, matchScore and matched tab', () => {
            beforeAll(async () => {
                const res = await request(app)
                    .patch('/api/auth/update-me')
                    .set(auth(free.token))
                    .send({ skills: ['zz-alpha', 'zz-beta'] });
                expect(res.status).toBe(200);
            });

            it('adds matchScore (overlap %) for a freelancer, and none for a client', async () => {
                const res = await request(app).get('/api/jobs?search=ZZFilter').set(auth(free.token));
                const score = Object.fromEntries(res.body.jobs.map((j) => [j.title, j.matchScore]));

                expect(score['ZZFilter one']).toBe(100); // alpha + beta
                expect(score['ZZFilter two']).toBe(100); // beta
                expect(score['ZZFilter five']).toBe(50); // alpha + gamma -> 1/2
                expect(score['ZZFilter three']).toBe(0); // gamma

                const asClient = await request(app).get('/api/jobs?search=ZZFilter').set(auth(client.token));
                asClient.body.jobs.forEach((j) => expect(j.matchScore).toBeUndefined());
            });

            it('lists only overlapping jobs in the matched tab and counts them', async () => {
                const res = await request(app).get('/api/jobs?tab=matched&search=ZZFilter').set(auth(free.token));

                expect(titles(res)).toEqual(['ZZFilter five', 'ZZFilter one', 'ZZFilter two']);
                expect(res.body.tabCounts.matched).toBeGreaterThanOrEqual(3);
            });

            it('gives a freelancer without skills an empty matched tab and 0 scores', async () => {
                const res = await request(app).get('/api/jobs?tab=matched&search=ZZFilter').set(auth(free2.token));
                expect(res.status).toBe(200);
                expect(res.body.jobs).toEqual([]);
                expect(res.body.tabCounts.matched).toBe(0);

                const plain = await request(app).get('/api/jobs?search=ZZFilter').set(auth(free2.token));
                plain.body.jobs.forEach((j) => expect(j.matchScore).toBe(0));
            });

            it('returns matchScore, skills and the proposal of the viewer in GET /jobs/:id', async () => {
                const res = await request(app).get(`/api/jobs/${j5.id}`).set(auth(free.token));
                expect(res.status).toBe(200);
                expect(res.body.job.matchScore).toBe(50);
                expect(skillNames(res.body.job)).toEqual(['zz-alpha', 'zz-gamma']);
                expect(res.body.job.isSaved).toBe(false);
                expect(res.body.myProposal).toBeNull();

                const asClient = await request(app).get(`/api/jobs/${j5.id}`).set(auth(client.token));
                expect(asClient.body.job.matchScore).toBeUndefined();
            });
        });
    });

    // -----------------------------------------------------------------------
    describe('profile: skills, location, availability, avatar', () => {
        it('updates the profile fields and returns skills as a flat sorted list', async () => {
            const res = await request(app)
                .patch('/api/auth/update-me')
                .set(auth(free2.token))
                .send({
                    headline: 'Fullstack engineer',
                    hourlyRate: 45,
                    location: 'Baku, Azerbaijan',
                    timezone: 'Asia/Baku',
                    availability: 'BUSY',
                    avatarUrl: 'https://example.com/me.png',
                    skills: ['zz-profile-b', 'zz-profile-a'],
                });

            expect(res.status).toBe(200);
            expect(res.body.user.location).toBe('Baku, Azerbaijan');
            expect(res.body.user.timezone).toBe('Asia/Baku');
            expect(res.body.user.availability).toBe('BUSY');
            expect(res.body.user.avatarUrl).toBe('https://example.com/me.png');
            expect(skillNames(res.body.user)).toEqual(['zz-profile-a', 'zz-profile-b']);
            expect(res.body.user.passwordHash).toBeUndefined();
        });

        it('returns the same data from GET /auth/me', async () => {
            const res = await request(app).get('/api/auth/me').set(auth(free2.token));

            expect(res.status).toBe(200);
            expect(res.body.user.email).toBe(emails[3]);
            expect(res.body.user.availability).toBe('BUSY');
            expect(skillNames(res.body.user)).toEqual(['zz-profile-a', 'zz-profile-b']);
        });

        it('keeps the other fields untouched when only some are sent', async () => {
            const res = await request(app)
                .patch('/api/auth/update-me')
                .set(auth(free2.token))
                .send({ availability: 'AVAILABLE' });

            expect(res.status).toBe(200);
            expect(res.body.user.availability).toBe('AVAILABLE');
            expect(res.body.user.location).toBe('Baku, Azerbaijan');
            expect(skillNames(res.body.user)).toHaveLength(2);
        });

        it('clears optional fields with null / empty string and skills with []', async () => {
            const res = await request(app)
                .patch('/api/auth/update-me')
                .set(auth(free2.token))
                .send({ location: null, avatarUrl: '', skills: [] });

            expect(res.status).toBe(200);
            expect(res.body.user.location).toBeNull();
            expect(res.body.user.avatarUrl).toBeNull();
            expect(res.body.user.skills).toEqual([]);
        });

        it('rejects invalid availability, non-http avatar URLs and too many skills', async () => {
            const badAvailability = await request(app)
                .patch('/api/auth/update-me')
                .set(auth(free2.token))
                .send({ availability: 'SLEEPING' });
            expect(badAvailability.status).toBe(400);

            const badAvatar = await request(app)
                .patch('/api/auth/update-me')
                .set(auth(free2.token))
                .send({ avatarUrl: 'javascript:alert(1)' });
            expect(badAvatar.status).toBe(400);

            const tooMany = await request(app)
                .patch('/api/auth/update-me')
                .set(auth(free2.token))
                .send({ skills: Array.from({ length: 16 }, (_, i) => `zz-lots-${i}`) });
            expect(tooMany.status).toBe(400);
            expect(tooMany.body.message).toMatch(/at most 15/i);
        });

        it('does not let a client set skills or an hourly rate', async () => {
            const skills = await request(app)
                .patch('/api/auth/update-me')
                .set(auth(client.token))
                .send({ skills: ['zz-client-skill'] });
            expect(skills.status).toBe(400);
            expect(skills.body.message).toMatch(/only freelancers/i);

            const rate = await request(app)
                .patch('/api/auth/update-me')
                .set(auth(client.token))
                .send({ hourlyRate: 20 });
            expect(rate.status).toBe(400);

            // Client öz ünvanını və əlçatanlığını yenə də dəyişə bilər
            const ok = await request(app)
                .patch('/api/auth/update-me')
                .set(auth(client.token))
                .send({ location: 'Berlin', availability: 'AVAILABLE' });
            expect(ok.status).toBe(200);
        });

        it('shows skills and location on the public profile, without private fields', async () => {
            await request(app)
                .patch('/api/auth/update-me')
                .set(auth(free2.token))
                .send({ location: 'Ganja', skills: ['zz-public'] });

            const res = await request(app).get(`/api/users/${free2.user.id}`).set(auth(client.token));

            expect(res.status).toBe(200);
            expect(res.body.user.location).toBe('Ganja');
            expect(skillNames(res.body.user)).toEqual(['zz-public']);
            expect(res.body.user.email).toBeUndefined();
            expect(res.body.user.deletedAt).toBeUndefined();
        });

        it('does not count drafts in the public "jobs posted" number', async () => {
            const before = await request(app).get(`/api/users/${client2.user.id}`).set(auth(free.token));
            const base = before.body.stats.jobsPosted;

            await request(app)
                .post('/api/jobs')
                .set(auth(client2.token))
                .send({
                    title: 'ZZProfile hidden draft',
                    description: 'A sufficiently long description for the test job post.',
                    budget: 100,
                    status: 'DRAFT',
                });
            await createJob(client2.token, { title: 'ZZProfile visible job' });

            const after = await request(app).get(`/api/users/${client2.user.id}`).set(auth(free.token));
            expect(after.body.stats.jobsPosted).toBe(base + 1);
        });

        it('soft-deletes the account and keeps skills, saved jobs and history rows', async () => {
            // Əvvəlki qırıq buraxlışdan qalan istifadəçi qeydiyyatı poza bilməsin
            await cleanUpUsers(['tx_temp@upra.com']);
            const temp = await registerUser({
                email: 'tx_temp@upra.com',
                password: PASSWORD,
                fullName: 'TX Temp',
                role: 'FREELANCER',
            });

            const job = await createJob(client.token, { title: 'ZZDelete saved target' });
            await request(app).patch('/api/auth/update-me').set(auth(temp.token)).send({ skills: ['zz-temp'] });
            await request(app).post(`/api/jobs/${job.id}/save`).set(auth(temp.token));

            const del = await request(app).delete('/api/auth/me').set(auth(temp.token)).send({ password: PASSWORD });
            expect(del.status).toBe(200);

            // Sətirlər qalır (gələcək audit üçün), istifadəçi isə yalnız deletedAt ilə işarələnir
            expect(await prisma.userSkill.count({ where: { userId: temp.user.id } })).toBe(1);
            expect(await prisma.savedJob.count({ where: { userId: temp.user.id } })).toBe(1);
            const stored = await prisma.user.findUnique({ where: { id: temp.user.id } });
            expect(stored.deletedAt).not.toBeNull();

            await prisma.user.delete({ where: { id: temp.user.id } });
        });
    });
});
