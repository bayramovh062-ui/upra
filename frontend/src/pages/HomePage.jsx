import { Link } from 'react-router-dom';
import { Icon } from '../components/ui';
import { useTranslation } from '../features/locale/useTranslation';

// Stitch landing dizaynı. Mətnlər yalnız layihənin real imkanlarını təsvir edir
// (escrow, sprint və s. hələ yoxdur, ona görə dizayndakı həmin iddialar çıxarılıb).
// Bütün mətnlər i18n açarı ilə verilir; nümunə lövhədəki kartlar da interfeys mətnidir.

const STEPS = [
    { icon: 'post_add', key: 'postJob' },
    { icon: 'contact_page', key: 'receiveProposals' },
    { icon: 'verified_user', key: 'signContract' },
    { icon: 'view_kanban', key: 'kanban' },
];

const FEATURES = [
    { icon: 'engineering', key: 'jobMarketplace', tags: ['search', 'proposals', 'access'] },
    { icon: 'dashboard_customize', key: 'board', tags: ['todo', 'inProgress', 'done'] },
    { icon: 'bolt', key: 'realtime', tags: ['drag', 'comments', 'sync'] },
];

const BOARD = [
    {
        key: 'todo',
        tone: 'text-on-surface',
        count: 2,
        cards: [
            { key: 'UPR-12', titleKey: 'wireframes', priority: 'HIGH', person: 'ER' },
            { key: 'UPR-14', titleKey: 'apiRoutes', priority: 'MEDIUM', person: 'DK' },
        ],
    },
    {
        key: 'inProgress',
        tone: 'text-primary-container',
        count: 1,
        cards: [{ key: 'UPR-9', titleKey: 'authForms', priority: 'HIGH', person: 'ER' }],
    },
    {
        key: 'done',
        tone: 'text-success-ink',
        count: 1,
        cards: [{ key: 'UPR-3', titleKey: 'schemaReview', priority: 'LOW', person: 'DK' }],
    },
];

const PRIORITY_TONE = {
    HIGH: 'bg-danger-soft text-danger-ink',
    MEDIUM: 'bg-warning-soft text-warning-ink',
    LOW: 'bg-surface-container text-on-surface-variant',
};

const BoardPreview = () => {
    const { t } = useTranslation();
    return (
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
                        {t('home.board.projectName')}
                        <span className="rounded-full bg-surface-container px-2 py-0.5 text-caption text-primary-container">
                            {t('home.board.active')}
                        </span>
                    </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-lowest px-2.5 py-1 text-label-sm text-secondary shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
                    {t('home.board.live')}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-6 bg-surface-container-low p-6 md:grid-cols-3">
                {BOARD.map((column) => (
                    <div key={column.key} className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 px-1">
                            <span className={`text-label-md font-semibold uppercase tracking-wider ${column.tone}`}>
                                {t(`home.board.${column.key}`)}
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
                                        {t(`home.board.priorities.${card.priority}`)}
                                    </span>
                                </div>
                                <h3 className="text-title-md leading-snug text-on-surface">
                                    {t(`home.board.cards.${card.titleKey}`)}
                                </h3>
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
};

const HomePage = () => {
    const { t } = useTranslation();
    return (
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
                        {t('home.hero.badge')}
                        <Icon name="arrow_forward" className="text-[16px]" />
                    </a>

                    <h1 className="max-w-4xl text-display-lg-mobile font-semibold tracking-tight text-on-surface sm:text-[54px] sm:leading-[62px]">
                        {t('home.hero.line1')} <br className="hidden sm:inline" />
                        <span className="text-primary-container">{t('home.hero.highlight')}</span>
                    </h1>

                    <p className="mt-4 max-w-2xl text-headline-sm font-normal leading-relaxed text-on-surface-variant">
                        {t('home.hero.subtitle')}
                    </p>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                        <Link
                            to="/register"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-container px-7 py-3.5 text-body-md font-medium text-on-primary shadow-sm transition-all hover:opacity-90"
                        >
                            <Icon name="search" className="text-[18px]" />
                            {t('home.hero.findWork')}
                        </Link>
                        <Link
                            to="/register"
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-container-lowest px-7 py-3.5 text-body-md font-medium text-on-surface shadow-sm transition-all hover:bg-surface-container-low"
                        >
                            <Icon name="group_add" className="text-[18px]" />
                            {t('home.hero.hireTalent')}
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
                            {t('home.workflow.eyebrow')}
                        </span>
                        <h2 className="mt-2 text-headline-lg tracking-tight text-on-surface">
                            {t('home.workflow.title')}
                        </h2>
                        <p className="mt-2 text-body-lg text-on-surface-variant">
                            {t('home.workflow.subtitle')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {STEPS.map((step, index) => (
                            <div
                                key={step.key}
                                className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-6 shadow-sm transition-all hover:-translate-y-1"
                            >
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-title-md font-bold text-primary-container">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <Icon name={step.icon} className="text-[24px] text-primary-container" />
                                </div>
                                <h3 className="text-title-md text-on-surface">
                                    {t(`home.workflow.steps.${step.key}.title`)}
                                </h3>
                                <p className="text-body-md text-on-surface-variant">
                                    {t(`home.workflow.steps.${step.key}.text`)}
                                </p>
                                <p className="mt-auto pt-4 text-caption font-medium text-primary-container">
                                    {t(`home.workflow.steps.${step.key}.note`)}
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
                            {t('home.features.eyebrow')}
                        </span>
                        <h2 className="mt-2 text-headline-lg tracking-tight text-on-surface">
                            {t('home.features.title')}
                        </h2>
                        <p className="mt-2 text-body-lg text-on-surface-variant">
                            {t('home.features.subtitle')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {FEATURES.map((feature) => (
                            <div
                                key={feature.key}
                                className="flex flex-col rounded-xl border border-line bg-surface-container-lowest p-6 shadow-sm transition-shadow hover:shadow-md"
                            >
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container text-primary-container">
                                    <Icon name={feature.icon} className="text-[28px]" />
                                </div>
                                <h3 className="mb-1 text-headline-sm text-on-surface">
                                    {t(`home.features.${feature.key}.title`)}
                                </h3>
                                <p className="mb-4 text-body-md text-on-surface-variant">
                                    {t(`home.features.${feature.key}.text`)}
                                </p>
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
                                            {t(`home.features.${feature.key}.tags.${tag}`)}
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
                            {t('home.cta.eyebrow')}
                        </span>
                        <h2 className="text-headline-lg font-bold tracking-tight text-white sm:text-[36px] sm:leading-[44px]">
                            {t('home.cta.title')}
                        </h2>
                        <p className="text-body-lg text-secondary-fixed-dim">
                            {t('home.cta.subtitle')}
                        </p>
                    </div>
                    <div className="z-10 flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
                        <Link
                            to="/register"
                            className="inline-flex w-full items-center justify-center rounded-xl bg-primary-container px-7 py-3.5 text-body-md font-medium text-on-primary shadow-sm transition-all hover:opacity-90 sm:w-auto"
                        >
                            {t('home.cta.createAccount')}
                        </Link>
                        <Link
                            to="/login"
                            className="inline-flex w-full items-center justify-center rounded-xl bg-[#374151] px-7 py-3.5 text-body-md font-medium text-on-primary shadow-sm transition-all hover:bg-[#4b5563] sm:w-auto"
                        >
                            {t('home.cta.signIn')}
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
};

export default HomePage;
