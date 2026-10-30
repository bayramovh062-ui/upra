import { Link } from 'react-router-dom';
import { Icon } from '../components/ui';

// Stitch landing dizaynı. Mətnlər yalnız layihənin real imkanlarını təsvir edir
// (escrow, sprint və s. hələ yoxdur, ona görə dizayndakı həmin iddialar çıxarılıb).

const STEPS = [
    {
        icon: 'post_add',
        title: 'Post job',
        text: 'Describe the work, set a budget and publish it to the marketplace.',
        note: 'Takes a few minutes',
    },
    {
        icon: 'contact_page',
        title: 'Receive proposals',
        text: 'Freelancers send a cover letter and a bid. Compare them in one list.',
        note: 'One proposal per freelancer',
    },
    {
        icon: 'verified_user',
        title: 'Sign contract',
        text: 'Accept a proposal and the contract starts. Other proposals are closed automatically.',
        note: 'One click',
    },
    {
        icon: 'view_kanban',
        title: 'Work on Kanban board',
        text: 'A project board is created for the contract. Both sides track tasks in real time.',
        note: 'Created automatically',
    },
];

const FEATURES = [
    {
        icon: 'engineering',
        title: 'Job marketplace',
        text: 'Clients publish jobs, freelancers browse, search and apply. Every job has a clear budget and status.',
        tags: ['Search', 'Proposals', 'Role-based access'],
    },
    {
        icon: 'dashboard_customize',
        title: 'Automatic project board',
        text: 'No copying tasks between tools. The moment a contract starts, a Kanban board with To Do, In Progress and Done is ready.',
        tags: ['To Do', 'In Progress', 'Done'],
    },
    {
        icon: 'bolt',
        title: 'Real-time updates',
        text: 'Move a card or write a comment and the other side sees it instantly, without refreshing the page.',
        tags: ['Drag and drop', 'Comments', 'Live sync'],
    },
];

const BOARD = [
    {
        title: 'To Do',
        tone: 'text-on-surface',
        count: 2,
        cards: [
            { key: 'UPR-12', title: 'Design landing page wireframes', priority: 'High', person: 'ER' },
            { key: 'UPR-14', title: 'Set up REST API routes', priority: 'Medium', person: 'DK' },
        ],
    },
    {
        title: 'In Progress',
        tone: 'text-primary-container',
        count: 1,
        cards: [{ key: 'UPR-9', title: 'Implement login and register forms', priority: 'High', person: 'ER' }],
    },
    {
        title: 'Done',
        tone: 'text-success-ink',
        count: 1,
        cards: [{ key: 'UPR-3', title: 'Database schema review', priority: 'Low', person: 'DK' }],
    },
];

const PRIORITY_TONE = {
    High: 'bg-danger-soft text-danger-ink',
    Medium: 'bg-warning-soft text-warning-ink',
    Low: 'bg-surface-container text-on-surface-variant',
};

const BoardPreview = () => (
    <div className="w-full overflow-hidden rounded-xl border border-line bg-surface-container-lowest shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low px-6 py-3">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="h-3 w-3 rounded-full bg-[#f87171]" />
                    <span className="h-3 w-3 rounded-full bg-[#fbbf24]" />
                    <span className="h-3 w-3 rounded-full bg-[#4ade80]" />
                </div>
                <div className="h-4 w-px bg-surface-variant" />
                <span className="flex items-center gap-2 text-title-md text-on-surface">
                    <Icon name="view_kanban" className="text-primary-container" />
                    Website redesign
                    <span className="rounded-full bg-surface-container px-2 py-0.5 text-caption text-primary-container">
                        Active
                    </span>
                </span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-lowest px-2.5 py-1 text-label-sm text-secondary shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
                Live · sample board
            </span>
        </div>

        <div className="grid grid-cols-1 gap-6 bg-surface-container-low p-6 md:grid-cols-3">
            {BOARD.map((column) => (
                <div key={column.title} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-1">
                        <span className={`text-label-md font-semibold uppercase tracking-wider ${column.tone}`}>
                            {column.title}
                        </span>
                        <span className="rounded-full bg-surface-variant px-2 py-0.5 text-caption font-semibold text-on-surface">
                            {column.count}
                        </span>
                    </div>
                    {column.cards.map((card) => (
                        <div
                            key={card.key}
                            className="flex flex-col gap-2 rounded-xl border border-line bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-caption text-secondary">{card.key}</span>
                                <span
                                    className={`rounded-full px-2 py-0.5 text-caption font-semibold ${PRIORITY_TONE[card.priority]}`}
                                >
                                    {card.priority}
                                </span>
                            </div>
                            <h3 className="text-title-md leading-snug text-on-surface">{card.title}</h3>
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-high text-[10px] font-bold text-primary">
                                {card.person}
                            </span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    </div>
);

const HomePage = () => (
    <>
        {/* Hero */}
        <div className="relative overflow-hidden bg-surface">
            <div className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[480px] w-[1100px] -translate-x-1/2 bg-primary-fixed opacity-30 blur-[130px]" />
            <div className="pointer-events-none absolute -top-32 right-12 -z-0 h-[380px] w-[380px] bg-surface-container opacity-50 blur-[90px]" />

            <section className="relative mx-auto flex w-full max-w-[1400px] flex-col items-center px-4 pb-14 pt-14 text-center sm:px-8">
                <a
                    href="#workflow"
                    className="mb-6 inline-flex items-center gap-2 rounded-full bg-surface-container-low px-4 py-1.5 text-label-md text-primary-container shadow-sm transition-all hover:bg-surface-container"
                >
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary-container" />
                    Marketplace and project board in one flow
                    <Icon name="arrow_forward" className="text-[16px]" />
                </a>

                <h1 className="max-w-4xl text-display-lg-mobile font-semibold tracking-tight text-on-surface sm:text-[54px] sm:leading-[62px]">
                    Hire. Collaborate. Deliver — <br className="hidden sm:inline" />
                    <span className="text-primary-container">in one place</span>
                </h1>

                <p className="mt-4 max-w-2xl text-headline-sm font-normal leading-relaxed text-on-surface-variant">
                    Upra combines a freelance marketplace with a Kanban workspace. Post a job, accept a proposal and
                    your project board is ready, so work never leaves the platform.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                    <Link
                        to="/register"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-container px-7 py-3.5 text-body-md font-medium text-on-primary shadow-sm transition-all hover:bg-primary"
                    >
                        <Icon name="search" className="text-[18px]" />
                        Find work
                    </Link>
                    <Link
                        to="/register"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-container-lowest px-7 py-3.5 text-body-md font-medium text-on-surface shadow-sm transition-all hover:bg-surface-container-low"
                    >
                        <Icon name="group_add" className="text-[18px]" />
                        Hire talent
                    </Link>
                </div>
            </section>

            <section className="relative mx-auto w-full max-w-[1360px] px-4 pb-20 sm:px-8">
                <BoardPreview />
            </section>
        </div>

        {/* 4 addım */}
        <section id="workflow" className="scroll-mt-16 bg-surface-container-lowest py-20">
            <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-8">
                <div className="mx-auto mb-14 max-w-3xl text-center">
                    <span className="text-caption font-semibold uppercase tracking-wider text-primary-container">
                        How it works
                    </span>
                    <h2 className="mt-2 text-headline-lg tracking-tight text-on-surface">
                        From job posting to finished work in four steps
                    </h2>
                    <p className="mt-2 text-body-lg text-on-surface-variant">
                        One continuous flow between hiring and day-to-day delivery.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {STEPS.map((step, index) => (
                        <div
                            key={step.title}
                            className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-6 shadow-sm transition-all hover:-translate-y-1"
                        >
                            <div className="mb-2 flex items-center justify-between">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-title-md font-bold text-primary-container">
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <Icon name={step.icon} className="text-[24px] text-primary-container" />
                            </div>
                            <h3 className="text-title-md text-on-surface">{step.title}</h3>
                            <p className="text-body-md text-on-surface-variant">{step.text}</p>
                            <p className="mt-auto pt-4 text-caption font-medium text-primary-container">
                                {step.note}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* 3 üstünlük */}
        <section id="features" className="scroll-mt-16 bg-surface py-24">
            <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-8">
                <div className="mx-auto mb-14 max-w-2xl text-center">
                    <span className="text-caption font-semibold uppercase tracking-wider text-primary-container">
                        Features
                    </span>
                    <h2 className="mt-2 text-headline-lg tracking-tight text-on-surface">
                        Everything a freelance project needs
                    </h2>
                    <p className="mt-2 text-body-lg text-on-surface-variant">
                        Find the right person, agree on the work and track it, all in the same place.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {FEATURES.map((feature) => (
                        <div
                            key={feature.title}
                            className="flex flex-col rounded-xl border border-line bg-surface-container-lowest p-6 shadow-sm transition-shadow hover:shadow-md"
                        >
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container text-primary-container">
                                <Icon name={feature.icon} className="text-[28px]" />
                            </div>
                            <h3 className="mb-1 text-headline-sm text-on-surface">{feature.title}</h3>
                            <p className="mb-4 text-body-md text-on-surface-variant">{feature.text}</p>
                            <div className="mt-auto flex flex-wrap gap-2">
                                {feature.tags.map((tag, i) => (
                                    <span
                                        key={tag}
                                        className={
                                            i === 0
                                                ? 'rounded-full bg-info-soft px-3 py-1 text-caption font-medium text-info-ink'
                                                : 'rounded-full bg-surface-container-low px-3 py-1 text-caption font-medium text-on-surface-variant'
                                        }
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-8">
            <div className="relative flex flex-col items-center justify-between gap-8 overflow-hidden rounded-xl bg-nav p-8 text-on-primary shadow-xl sm:p-14 md:flex-row">
                <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-primary opacity-20 blur-3xl" />
                <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary-container opacity-25 blur-2xl" />
                <div className="z-10 flex max-w-xl flex-col gap-2 text-center md:text-left">
                    <span className="text-caption uppercase tracking-wider text-secondary-fixed-dim">
                        Get started
                    </span>
                    <h2 className="text-headline-lg font-bold tracking-tight text-white sm:text-[36px] sm:leading-[44px]">
                        Ready to run your next project on Upra?
                    </h2>
                    <p className="text-body-lg text-secondary-fixed-dim">
                        Create a free account as a client or a freelancer and start in minutes.
                    </p>
                </div>
                <div className="z-10 flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
                    <Link
                        to="/register"
                        className="inline-flex w-full items-center justify-center rounded-xl bg-primary-container px-7 py-3.5 text-body-md font-medium text-on-primary shadow-sm transition-all hover:bg-primary sm:w-auto"
                    >
                        Create a free account
                    </Link>
                    <Link
                        to="/login"
                        className="inline-flex w-full items-center justify-center rounded-xl bg-[#374151] px-7 py-3.5 text-body-md font-medium text-on-primary shadow-sm transition-all hover:bg-[#4b5563] sm:w-auto"
                    >
                        Sign in
                    </Link>
                </div>
            </div>
        </section>
    </>
);

export default HomePage;
