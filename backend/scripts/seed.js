import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// DEMO MƏLUMAT (seed). Təqdimat və lokal sınaq üçün hazır hesablar, işlər, müqavilələr, pul kisələri və bir açıq mübahisə yaradır.
//
// İstifadə (backend qovluğunda):
//   npm run seed                   -> demo hesabları silib yenidən yaradır (təkrar işlədilə bilər)
//   npm run seed:reset             -> yalnız demo hesabları və onlara bağlı məlumatı silir
//   npm run seed -- --allow-remote -> lokal olmayan bazada (məs. demo Neon bazası) işlətmək üçün açıq razılıq
//
// Təhlükəsizlik:
//  - NODE_ENV=production olanda heç vaxt işləmir.
//  - Baza lokal deyilsə (localhost/127.0.0.1), yalnız --allow-remote ilə işləyir.
//  - Yalnız "@demo.upra.local" e-poçtlu hesablara toxunur; digər istifadəçilərin məlumatı silinmir.
//  - Maliyyə əməliyyatları real servis funksiyaları ilə gedir (topUp, fundMilestone, ...), ledger həmişə düzgün qalır.
dotenv.config();

const DEMO_DOMAIN = 'demo.upra.local';
const DEMO_PASSWORD = 'Demo12345!';
const args = new Set(process.argv.slice(2));

const fail = (message) => {
    console.error(`[seed] ${message}`);
    process.exit(1);
};

if (process.env.NODE_ENV === 'production') {
    fail('Refusing to run with NODE_ENV=production.');
}
if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is not defined (backend/.env).');
}

let dbHost;
try {
    dbHost = new URL(process.env.DATABASE_URL).hostname;
} catch {
    fail('DATABASE_URL is not a valid URL.');
}

const isLocalDb = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(dbHost);
if (!isLocalDb && !args.has('--allow-remote')) {
    fail(
        `Database host "${dbHost}" is not local. Re-run with --allow-remote only if you intend to seed this demo database.`
    );
}

const { default: prisma } = await import('../src/config/db.js');
const { topUp, fundMilestone, submitMilestone, approveMilestone, openDispute } = await import(
    '../src/services/financialService.js'
);

const email = (key) => `${key}@${DEMO_DOMAIN}`;
const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

// ---------------------------------------------------------------------------
// Təmizlik: yalnız demo hesablar. Sıra FK məhdudiyyətlərinə görədir (tests/helpers/db.js ilə eyni məntiq).
// ---------------------------------------------------------------------------
const resetDemoData = async () => {
    const users = await prisma.user.findMany({
        where: { email: { endsWith: `@${DEMO_DOMAIN}` } },
        select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return 0;

    const contractWhere = { OR: [{ clientId: { in: ids } }, { freelancerId: { in: ids } }] };

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
    await prisma.report.deleteMany({ where: { OR: [{ reporterId: { in: ids } }, { adminId: { in: ids } }] } });
    await prisma.dispute.deleteMany({ where: { OR: [{ openedById: { in: ids } }, { contract: contractWhere }] } });
    await prisma.milestoneSubmission.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { contract: contractWhere }] } });
    await prisma.review.deleteMany({
        where: { OR: [{ reviewerId: { in: ids } }, { revieweeId: { in: ids } }, { contract: contractWhere }] },
    });
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
    // Bildiriş, söhbət, mesaj, token, saxlanmış iş və bacarıq bağları CASCADE ilə gedir
    await prisma.user.deleteMany({ where: { id: { in: ids } } });

    return ids.length;
};

// ---------------------------------------------------------------------------
// Köməkçilər
// ---------------------------------------------------------------------------
const loadLookup = async (model, slugs, label) => {
    const rows = await prisma[model].findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
    const map = Object.fromEntries(rows.map((r) => [r.slug, r.id]));
    const missing = slugs.filter((s) => !map[s]);
    if (missing.length > 0) {
        fail(`Missing ${label}: ${missing.join(', ')}. Run "npx prisma migrate deploy" first (taxonomy ships with migrations).`);
    }
    return map;
};

const fund = async (clientId, milestone) => {
    await topUp(clientId, milestone.amountCents); // demo pul: dəqiq lazım olan məbləğ
    return fundMilestone(milestone.id, clientId);
};

const payMilestone = async (clientId, freelancerId, milestone) => {
    await fund(clientId, milestone);
    await submitMilestone(milestone.id, freelancerId);
    await approveMilestone(milestone.id, { actorId: clientId });
};

const main = async () => {
    const removed = await resetDemoData();
    console.log(`[seed] removed ${removed} existing demo account(s)`);
    if (args.has('--reset-only')) return;

    const skillSlugs = [
        'react', 'node.js', 'postgresql', 'typescript', 'prisma', 'rest api', 'docker', 'ci/cd', 'github actions',
        'aws', 'linux', 'figma', 'ui/ux', 'design systems', 'prototyping', 'playwright', 'jest', 'tailwind css',
    ];
    const categorySlugs = [
        'fullstack-development', 'backend-systems', 'ui-ux-product-design', 'devops-cloud', 'qa-testing',
        'frontend-development',
    ];
    const skillId = await loadLookup('skill', skillSlugs, 'skills');
    const categoryId = await loadLookup('category', categorySlugs, 'categories');

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    const makeUser = ({ key, fullName, role, headline, bio, hourlyRate, location, skills = [] }) =>
        prisma.user.create({
            data: {
                email: email(key),
                passwordHash,
                fullName,
                role,
                headline,
                bio,
                hourlyRate,
                location,
                timezone: 'Asia/Baku',
                emailVerified: true,
                emailVerifiedAt: new Date(),
                skills: { create: skills.map((slug) => ({ skillId: skillId[slug] })) },
            },
        });

    const makeJob = ({ client, title, description, budget, category, level, payment = 'MILESTONES', skills = [], status = 'OPEN', deadlineDays }) =>
        prisma.jobPost.create({
            data: {
                clientId: client.id,
                title,
                description,
                budget,
                status,
                categoryId: categoryId[category],
                experienceLevel: level,
                paymentStructure: payment,
                deadline: deadlineDays ? daysFromNow(deadlineDays) : null,
                skills: { create: skills.map((slug) => ({ skillId: skillId[slug] })) },
            },
        });

    const makeProposal = (job, freelancer, bidAmount, coverLetter) =>
        prisma.proposal.create({ data: { jobPostId: job.id, freelancerId: freelancer.id, bidAmount, coverLetter } });

    // contractController.createContract (+ acceptContract) ilə eyni nəticə: müqavilə, lövhə, mərhələlər, təklif və iş statusları
    const makeContract = async ({ job, proposal, client, freelancer, milestones, accepted = true }) => {
        const contract = await prisma.$transaction(async (tx) => {
            await tx.jobPost.update({ where: { id: job.id }, data: { status: 'IN_PROGRESS' } });
            const created = await tx.contract.create({
                data: {
                    jobPostId: job.id,
                    proposalId: proposal.id,
                    clientId: client.id,
                    freelancerId: freelancer.id,
                    status: accepted ? 'ACTIVE' : 'PENDING_ACCEPTANCE',
                    freelancerAcceptedAt: accepted ? new Date() : null,
                    board: { create: {} },
                },
            });
            await tx.milestone.createMany({
                data: milestones.map((m, index) => ({
                    contractId: created.id,
                    title: m.title,
                    amountCents: m.amountCents,
                    sequence: index + 1,
                    dueDate: m.dueDays ? daysFromNow(m.dueDays) : null,
                    maxRevisions: 2,
                    updatedAt: new Date(),
                })),
            });
            await tx.proposal.update({ where: { id: proposal.id }, data: { status: 'ACCEPTED' } });
            return created;
        });
        const created = await prisma.milestone.findMany({ where: { contractId: contract.id }, orderBy: { sequence: 'asc' } });
        return { contract, milestones: created };
    };

    // issues: [{ title, status, priority, milestone (1-based, optional), assignee ('client' | omitted = freelancer) }]
    const makeBoard = async ({ contract, milestones, client, freelancer, issues }) => {
        const board = await prisma.board.findUniqueOrThrow({ where: { contractId: contract.id } });
        const positions = {};
        for (const issue of issues) {
            positions[issue.status] = (positions[issue.status] ?? 0) + 1000;
            await prisma.issue.create({
                data: {
                    boardId: board.id,
                    title: issue.title,
                    description: issue.description ?? null,
                    status: issue.status,
                    priority: issue.priority ?? 'MEDIUM',
                    position: positions[issue.status],
                    createdById: client.id,
                    assigneeId: issue.assignee === 'client' ? client.id : freelancer.id,
                    milestoneId: issue.milestone ? milestones[issue.milestone - 1].id : null,
                },
            });
        }
    };

    // messages: [{ from: 'client' | 'freelancer', body }]; unreadFor: son mesajı hələ oxumayan tərəf
    const makeConversation = async ({ client, freelancer, messages, unreadFor = null }) => {
        const start = Date.now() - messages.length * 5 * 60 * 1000;
        const conversation = await prisma.conversation.create({
            data: { clientId: client.id, freelancerId: freelancer.id },
        });
        let last = null;
        for (const [index, message] of messages.entries()) {
            last = new Date(start + index * 5 * 60 * 1000);
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    senderId: message.from === 'client' ? client.id : freelancer.id,
                    body: message.body,
                    createdAt: last,
                },
            });
        }
        const readAt = (side) => (unreadFor === side ? new Date(last.getTime() - 60 * 1000) : last);
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: last, clientLastReadAt: readAt('client'), freelancerLastReadAt: readAt('freelancer') },
        });
    };

    // -----------------------------------------------------------------------
    // 1. Hesablar
    // -----------------------------------------------------------------------
    const admin = await makeUser({
        key: 'admin', fullName: 'Demo Admin', role: 'ADMIN',
        headline: 'Platform moderator',
    });
    const leyla = await makeUser({
        key: 'leyla.client', fullName: 'Leyla Hasanova', role: 'CLIENT',
        headline: 'Product lead at a fintech startup',
        bio: 'I turn product ideas into shippable features and work with freelancers on a milestone basis.',
        location: 'Baku, Azerbaijan',
    });
    const orxan = await makeUser({
        key: 'orxan.client', fullName: 'Orxan Aliyev', role: 'CLIENT',
        headline: 'Founder, logistics SaaS',
        bio: 'Small team, fast iterations. I care about clear scope and honest communication.',
        location: 'Ganja, Azerbaijan',
    });
    const aysel = await makeUser({
        key: 'aysel.freelancer', fullName: 'Aysel Karimova', role: 'FREELANCER',
        headline: 'Full-stack developer (React, Node.js, PostgreSQL)',
        bio: 'Five years building web products end to end. I write tests and document what I build.',
        hourlyRate: 45, location: 'Baku, Azerbaijan',
        skills: ['react', 'node.js', 'postgresql', 'typescript', 'prisma', 'rest api'],
    });
    const rauf = await makeUser({
        key: 'rauf.freelancer', fullName: 'Rauf Mammadov', role: 'FREELANCER',
        headline: 'DevOps engineer (Docker, AWS, CI/CD)',
        bio: 'I automate deployments and make systems observable and boring in the best way.',
        hourlyRate: 55, location: 'Sumqayit, Azerbaijan',
        skills: ['docker', 'ci/cd', 'github actions', 'aws', 'linux'],
    });
    const nigar = await makeUser({
        key: 'nigar.freelancer', fullName: 'Nigar Quliyeva', role: 'FREELANCER',
        headline: 'Product designer (Figma, design systems)',
        bio: 'I design clear interfaces and hand off tidy component libraries developers enjoy using.',
        hourlyRate: 40, location: 'Baku, Azerbaijan',
        skills: ['figma', 'ui/ux', 'design systems', 'prototyping'],
    });
    const tural = await makeUser({
        key: 'tural.freelancer', fullName: 'Tural Ismayilov', role: 'FREELANCER',
        headline: 'QA automation engineer (Playwright, Jest)',
        bio: 'I find the bugs before your users do and leave you with a test suite that runs in CI.',
        hourlyRate: 35, location: 'Baku, Azerbaijan',
        skills: ['playwright', 'jest', 'typescript'],
    });

    // -----------------------------------------------------------------------
    // 2. Açıq iş elanları (bazar və təkliflər) + bir qaralama
    // -----------------------------------------------------------------------
    const bookingJob = await makeJob({
        client: leyla, title: 'Build a booking dashboard with React and Node.js',
        description: 'We need an internal dashboard to manage bookings: list, filters, status changes and a simple calendar view. REST API in Node.js with PostgreSQL, React front end. Clear milestones and tests are expected.',
        budget: 2400, category: 'fullstack-development', level: 'MID', skills: ['react', 'node.js', 'postgresql'], deadlineDays: 35,
    });
    await makeProposal(
        bookingJob, aysel, 2200,
        'I have built similar admin dashboards with React and Node.js. I would start with the API and data model, then the list and filters, and finish with the calendar view. Each milestone ships with tests.'
    );

    const onboardingJob = await makeJob({
        client: orxan, title: 'Design a mobile onboarding flow in Figma',
        description: 'Three-screen onboarding for our courier app with a clickable prototype and a small set of reusable components. Brand colours and a logo are provided.',
        budget: 900, category: 'ui-ux-product-design', level: 'MID', payment: 'LUMP_SUM',
        skills: ['figma', 'ui/ux', 'prototyping'], deadlineDays: 21,
    });
    await makeProposal(
        onboardingJob, nigar, 850,
        'I can deliver the onboarding screens with a clickable prototype and a tidy component set. I usually share a first draft within three days so we can adjust early.'
    );

    const cicdJob = await makeJob({
        client: orxan, title: 'Set up CI/CD with GitHub Actions and Docker',
        description: 'Automate lint, tests and Docker image builds for a Node.js monorepo, and deploy previews for pull requests. Documentation for the team is part of the scope.',
        budget: 1500, category: 'devops-cloud', level: 'MID', skills: ['docker', 'github actions', 'ci/cd'], deadlineDays: 28,
    });
    await makeProposal(
        cicdJob, rauf, 1400,
        'I will set up a pipeline with caching, parallel jobs and preview deployments, and hand over a short runbook so the team can maintain it.'
    );

    const e2eJob = await makeJob({
        client: leyla, title: 'End-to-end test suite with Playwright',
        description: 'Cover the main user journeys of our web app with Playwright, including a mobile viewport, and run the suite in CI.',
        budget: 1200, category: 'qa-testing', level: 'MID', skills: ['playwright', 'jest'], deadlineDays: 40,
    });

    await makeJob({
        client: leyla, title: 'Landing page redesign (draft)',
        description: 'Refresh of the marketing landing page. Still collecting requirements, not published yet.',
        budget: 600, category: 'frontend-development', level: 'ENTRY', status: 'DRAFT', skills: ['react', 'tailwind css'],
    });

    // -----------------------------------------------------------------------
    // 3. Müqavilə A: TAMAMLANMIŞ (Leyla + Aysel), rəylərlə
    // -----------------------------------------------------------------------
    const jobA = await makeJob({
        client: leyla, title: 'Migrate the REST API to Prisma and PostgreSQL',
        description: 'Move our legacy API from raw SQL to Prisma on PostgreSQL without changing the public contract.',
        budget: 1500, category: 'backend-systems', level: 'MID', skills: ['node.js', 'prisma', 'postgresql'],
    });
    const proposalA = await makeProposal(jobA, aysel, 1500, 'I have done this migration before and will keep the public API stable while moving the data layer.');
    const a = await makeContract({
        job: jobA, proposal: proposalA, client: leyla, freelancer: aysel,
        milestones: [
            { title: 'Schema design and migration plan', amountCents: 60000 },
            { title: 'API migration and data import', amountCents: 90000 },
        ],
    });
    await makeBoard({
        ...a, client: leyla, freelancer: aysel,
        issues: [
            { title: 'Model the existing tables in Prisma', status: 'DONE', priority: 'HIGH', milestone: 1 },
            { title: 'Write the migration and rollback plan', status: 'DONE', milestone: 1 },
            { title: 'Port endpoints to Prisma queries', status: 'DONE', priority: 'HIGH', milestone: 2 },
            { title: 'Import production-like data and verify counts', status: 'DONE', milestone: 2 },
        ],
    });
    for (const milestone of a.milestones) await payMilestone(leyla.id, aysel.id, milestone); // son ödənişdən sonra müqavilə avtomatik COMPLETED olur
    await prisma.review.createMany({
        data: [
            { contractId: a.contract.id, reviewerId: leyla.id, revieweeId: aysel.id, rating: 5, comment: 'Clear communication, tidy code and delivered a day early. Would hire again.' },
            { contractId: a.contract.id, reviewerId: aysel.id, revieweeId: leyla.id, rating: 5, comment: 'Well-defined scope and fast approvals. A pleasure to work with.' },
        ],
    });

    // -----------------------------------------------------------------------
    // 4. Müqavilə B: AKTİV, bir mərhələ təsdiq gözləyir (Orxan + Rauf)
    // -----------------------------------------------------------------------
    const jobB = await makeJob({
        client: orxan, title: 'Dockerize and deploy the API to AWS',
        description: 'Containerize the API, deploy it to AWS ECS and add basic monitoring.',
        budget: 2000, category: 'devops-cloud', level: 'SENIOR', skills: ['docker', 'aws', 'linux'],
    });
    const proposalB = await makeProposal(jobB, rauf, 2000, 'I will containerize the service, provision ECS with Terraform-style repeatability and set up alarms for the essentials.');
    const b = await makeContract({
        job: jobB, proposal: proposalB, client: orxan, freelancer: rauf,
        milestones: [
            { title: 'Dockerfile and local compose setup', amountCents: 70000, dueDays: -5 },
            { title: 'AWS ECS deployment', amountCents: 80000, dueDays: 3 },
            { title: 'Monitoring and runbook', amountCents: 50000, dueDays: 14 },
        ],
    });
    await makeBoard({
        ...b, client: orxan, freelancer: rauf,
        issues: [
            { title: 'Write a multi-stage Dockerfile', status: 'DONE', priority: 'HIGH', milestone: 1 },
            { title: 'docker-compose for local development', status: 'DONE', milestone: 1 },
            { title: 'Provision the ECS service', status: 'DONE', priority: 'HIGH', milestone: 2 },
            { title: 'Configure health checks and autoscaling', status: 'DONE', milestone: 2 },
            { title: 'Create CloudWatch alarms', status: 'TODO', milestone: 3 },
            { title: 'Write the on-call runbook', status: 'TODO', priority: 'LOW' },
        ],
    });
    await payMilestone(orxan.id, rauf.id, b.milestones[0]);
    await fund(orxan.id, b.milestones[1]);
    await submitMilestone(b.milestones[1].id, rauf.id); // IN_REVIEW: Orxan təsdiqləyə və ya dəyişiklik istəyə bilər

    // -----------------------------------------------------------------------
    // 5. Müqavilə C: AKTİV, açıq mübahisə ilə (Leyla + Nigar), admin həll edir
    // -----------------------------------------------------------------------
    const jobC = await makeJob({
        client: leyla, title: 'Marketing site UI kit',
        description: 'A reusable UI kit for our marketing site, following the agreed design system.',
        budget: 1200, category: 'ui-ux-product-design', level: 'MID', skills: ['figma', 'design systems'],
    });
    const proposalC = await makeProposal(jobC, nigar, 1200, 'I will build the kit in Figma with documented variants and spacing tokens.');
    const c = await makeContract({
        job: jobC, proposal: proposalC, client: leyla, freelancer: nigar,
        milestones: [
            { title: 'Core components', amountCents: 70000 },
            { title: 'Cards, forms and page templates', amountCents: 50000 },
        ],
    });
    await makeBoard({
        ...c, client: leyla, freelancer: nigar,
        issues: [
            { title: 'Buttons and inputs', status: 'DONE', milestone: 1 },
            { title: 'Typography and colour tokens', status: 'DONE', milestone: 1 },
            { title: 'Card variants', status: 'IN_PROGRESS', priority: 'HIGH', milestone: 2 },
            { title: 'Fix the spacing scale', status: 'TODO', milestone: 2 },
        ],
    });
    await payMilestone(leyla.id, nigar.id, c.milestones[0]);
    await fund(leyla.id, c.milestones[1]);
    await submitMilestone(c.milestones[1].id, nigar.id);
    await openDispute(c.milestones[1].id, leyla.id, {
        reason: 'Delivered components do not match the agreed design system',
        details: 'The spacing scale and card variants differ from the approved tokens. I asked for changes but we could not agree on the scope.',
    });

    // -----------------------------------------------------------------------
    // 6. Müqavilə D: təklif frilanserin cavabını gözləyir (Orxan -> Tural)
    // -----------------------------------------------------------------------
    const jobD = await makeJob({
        client: orxan, title: 'Regression tests for the checkout flow',
        description: 'Automated regression tests for our checkout flow, runnable in CI.',
        budget: 800, category: 'qa-testing', level: 'MID', skills: ['playwright', 'jest'],
    });
    const proposalD = await makeProposal(jobD, tural, 800, 'I will cover the happy path and the main failure cases with Playwright and wire it into your CI.');
    await makeContract({
        job: jobD, proposal: proposalD, client: orxan, freelancer: tural, accepted: false,
        milestones: [
            { title: 'Happy-path tests', amountCents: 40000 },
            { title: 'Failure cases and CI integration', amountCents: 40000 },
        ],
    });

    // -----------------------------------------------------------------------
    // 7. Söhbətlər, şikayət, əlavə demo pul
    // -----------------------------------------------------------------------
    await makeConversation({
        client: leyla, freelancer: aysel,
        messages: [
            { from: 'client', body: 'Hi Aysel, thanks for the proposal on the booking dashboard.' },
            { from: 'freelancer', body: 'Thanks Leyla! Happy to start as soon as you are ready.' },
            { from: 'client', body: 'Could you share how you would structure the calendar view?' },
            { from: 'freelancer', body: 'Sure. I would build it on the same API as the list, so filters apply to both views.' },
        ],
    });
    await makeConversation({
        client: orxan, freelancer: rauf, unreadFor: 'client',
        messages: [
            { from: 'freelancer', body: 'The ECS milestone is submitted. The health checks are in place.' },
            { from: 'freelancer', body: 'Let me know if you want me to walk you through the deployment.' },
        ],
    });

    await prisma.report.create({
        data: {
            reporterId: nigar.id,
            targetType: 'JOB',
            targetId: e2eJob.id,
            reason: 'Possible duplicate posting',
            details: 'This job looks very similar to another posting from the same client.',
        },
    });

    await topUp(leyla.id, 35000); // $350: Leyla yeni mərhələni maliyyələşdirə bilsin
    await topUp(orxan.id, 100000); // $1000: D təklifi qəbul olunandan sonra ilk mərhələ üçün

    // -----------------------------------------------------------------------
    // Xülasə
    // -----------------------------------------------------------------------
    console.log('\n[seed] Demo data created. Password for every account: ' + DEMO_PASSWORD + '\n');
    console.table(
        [admin, leyla, orxan, aysel, rauf, nigar, tural].map((u) => ({
            role: u.role,
            name: u.fullName,
            email: u.email,
        }))
    );
    console.log(
        [
            'Scenarios:',
            '  Leyla (client)    - COMPLETED contract with reviews (Aysel), open dispute (Nigar), 2 open jobs, 1 draft',
            '  Orxan (client)    - milestone waiting for approval (Rauf), contract offer pending (Tural), unread message',
            '  Aysel             - completed contract, 5-star review, available balance to withdraw, pending proposal',
            '  Rauf              - active contract, milestone IN_REVIEW',
            '  Nigar             - active contract in DISPUTE; also has an open report to review',
            '  Tural             - contract offer to accept',
            '  Admin             - 1 open dispute to resolve, 1 open report',
        ].join('\n')
    );
};

try {
    await main();
} catch (err) {
    console.error(`[seed] Failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
