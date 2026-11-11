import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    Button,
    Card,
    EmptyState,
    ErrorState,
    Icon,
    Input,
    PageHeader,
    Pagination,
    Select,
    Skeleton,
} from '../components/ui';
import { cn } from '../lib/cn';
import { formatMoney } from '../lib/format';
import { EXPERIENCE_VALUES, PAYMENT_VALUES, experienceLabel, paymentLabel } from '../lib/labels';
import { toSkillSlug } from '../lib/skills';
import { useDebounce } from '../lib/useDebounce';
import JobCard from '../features/jobs/JobCard';
import JobFilters from '../features/jobs/JobFilters';
import { useTranslation } from '../features/locale/useTranslation';
import { useGetJobsQuery } from '../features/jobs/jobsApi';
import { useGetCategoriesQuery } from '../features/taxonomy/taxonomyApi';

const PAGE_SIZE = 10;

// "a,b,c" -> ["a","b","c"]
const csv = (value) =>
    (value || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

const ListSkeleton = () => (
    <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-6">
                <div className="flex justify-between gap-4">
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-7 w-24" />
                </div>
                <Skeleton className="mt-4 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-4/5" />
                <Skeleton className="mt-6 h-8 w-1/2" />
            </Card>
        ))}
    </div>
);

const TabButton = ({ active, icon, count, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
            'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-1.5 text-body-md transition-colors',
            active
                ? 'bg-inverse-surface font-medium text-on-primary shadow-sm'
                : 'bg-surface-container-low text-secondary hover:bg-surface-container hover:text-on-surface'
        )}
    >
        {icon && <Icon name={icon} className={cn('text-[16px]', !active && 'text-primary')} />}
        {children}
        {count !== undefined && <span className={cn('tabular', active ? 'opacity-80' : 'text-secondary')}>({count})</span>}
    </button>
);

const FilterChip = ({ label, onRemove, removeLabel }) => (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-caption text-on-surface">
        {label}
        <button type="button" onClick={onRemove} aria-label={removeLabel} className="flex items-center hover:text-primary-container">
            <Icon name="close" className="text-[13px]" />
        </button>
    </span>
);

// Frilanser üçün "Find work" (Stitch find_work dizaynı).
// Bütün filtrlər URL-də saxlanılır: səhifəni yeniləyəndə və ya linki göndərəndə nəticə eyni qalır.
const JobsPage = () => {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useSelector((state) => state.auth.user);
    const isFreelancer = user?.role === 'FREELANCER';

    const sortOptions = [
        { value: 'newest', label: t('jobs.sort.newest') },
        { value: 'budget_desc', label: t('jobs.sort.budgetDesc') },
        { value: 'budget_asc', label: t('jobs.sort.budgetAsc') },
        { value: 'proposals_desc', label: t('jobs.sort.proposalsDesc') },
    ];

    // ---- URL-dən oxu ----
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const sortParam = searchParams.get('sort');
    const sort = sortOptions.some((o) => o.value === sortParam) ? sortParam : 'newest';
    const tabParam = searchParams.get('tab');
    // Saved və Matched yalnız frilanser üçündür (backend də client üçün 403 qaytarır)
    const tab = isFreelancer && (tabParam === 'saved' || tabParam === 'matched') ? tabParam : 'all';
    const search = searchParams.get('search') || '';
    const minBudget = searchParams.get('minBudget') || '';
    const maxBudget = searchParams.get('maxBudget') || '';
    const category = csv(searchParams.get('category'));
    const experienceLevel = csv(searchParams.get('experienceLevel')).filter((v) => EXPERIENCE_VALUES.includes(v));
    const skills = csv(searchParams.get('skills'));
    const skillsMode = searchParams.get('skillsMode') === 'all' ? 'all' : '';
    const paymentStructure = PAYMENT_VALUES.includes(searchParams.get('paymentStructure'))
        ? searchParams.get('paymentStructure')
        : '';

    const filterValues = { minBudget, maxBudget, category, experienceLevel, paymentStructure, skills, skillsMode };

    const hasFilters = Boolean(
        search || minBudget || maxBudget || category.length || experienceLevel.length || skills.length || paymentStructure
    );

    // Axtarış sahəsi lokal state-dir, URL-ə debounce ilə yazılır
    const [searchInput, setSearchInput] = useState(search);
    const debouncedSearch = useDebounce(searchInput, 400);

    const updateParams = (patch, { keepPage = false } = {}) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                Object.entries(patch).forEach(([key, value]) => {
                    const text = Array.isArray(value) ? value.join(',') : value;
                    if (text === '' || text === null || text === undefined) next.delete(key);
                    else next.set(key, String(text));
                });
                if (!keepPage) next.delete('page');
                return next;
            },
            { replace: true }
        );
    };

    // Debounce olunmuş axtarışı URL-ə yaz (dəyər artıq eynidirsə heç nə etmir)
    useEffect(() => {
        const value = debouncedSearch.trim();
        setSearchParams(
            (prev) => {
                if ((prev.get('search') || '') === value) return prev;
                const next = new URLSearchParams(prev);
                if (value) next.set('search', value);
                else next.delete('search');
                next.delete('page');
                return next;
            },
            { replace: true }
        );
    }, [debouncedSearch, setSearchParams]);

    const { data, isLoading, isFetching, isError, refetch } = useGetJobsQuery({
        page,
        limit: PAGE_SIZE,
        sort,
        ...(tab !== 'all' && { tab }),
        ...(search && { search }),
        ...(minBudget && { minBudget }),
        ...(maxBudget && { maxBudget }),
        ...(category.length > 0 && { category: category.join(',') }),
        ...(experienceLevel.length > 0 && { experienceLevel: experienceLevel.join(',') }),
        ...(skills.length > 0 && { skills: skills.join(',') }),
        ...(skills.length > 1 && skillsMode === 'all' && { skillsMode }),
        ...(paymentStructure && { paymentStructure }),
    });

    const { data: categoriesData } = useGetCategoriesQuery();

    const jobs = data?.jobs ?? [];
    const pagination = data?.pagination;
    const tabCounts = data?.tabCounts;
    const mySkills = user?.skills ?? [];
    const mySkillSlugs = new Set(mySkills.map((s) => toSkillSlug(typeof s === 'string' ? s : s.name)));

    const resetFilters = () => {
        setSearchInput('');
        // Tab və sıralama qalır, qalan filtrlər silinir
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams();
                if (prev.get('tab')) next.set('tab', prev.get('tab'));
                if (prev.get('sort')) next.set('sort', prev.get('sort'));
                return next;
            },
            { replace: true }
        );
    };

    const changeTab = (nextTab) => updateParams({ tab: nextTab === 'all' ? '' : nextTab });

    const changePage = (nextPage) => {
        updateParams({ page: nextPage }, { keepPage: true });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Aktiv filtr çipləri
    const budgetLabel = () => {
        if (minBudget && maxBudget) return `${formatMoney(minBudget)} – ${formatMoney(maxBudget)}`;
        if (minBudget) return t('jobs.chip.from', { amount: formatMoney(minBudget) });
        return t('jobs.chip.upTo', { amount: formatMoney(maxBudget) });
    };
    const categoryName = (slug) => categoriesData?.categories?.find((c) => c.slug === slug)?.name ?? slug;

    const chips = [
        search && {
            key: 'search',
            label: `“${search}”`,
            onRemove: () => {
                setSearchInput('');
                updateParams({ search: '' });
            },
        },
        (minBudget || maxBudget) && {
            key: 'budget',
            label: budgetLabel(),
            onRemove: () => updateParams({ minBudget: '', maxBudget: '' }),
        },
        paymentStructure && {
            key: 'payment',
            label: paymentLabel(paymentStructure),
            onRemove: () => updateParams({ paymentStructure: '' }),
        },
        ...category.map((slug) => ({
            key: `category-${slug}`,
            label: categoryName(slug),
            onRemove: () => updateParams({ category: category.filter((c) => c !== slug) }),
        })),
        ...experienceLevel.map((level) => ({
            key: `level-${level}`,
            label: experienceLabel(level),
            onRemove: () => updateParams({ experienceLevel: experienceLevel.filter((l) => l !== level) }),
        })),
        ...skills.map((name) => ({
            key: `skill-${name}`,
            label: name,
            onRemove: () => updateParams({ skills: skills.filter((s) => s !== name) }),
        })),
    ].filter(Boolean);

    // Boş vəziyyət mətni tab-a görə
    const renderEmpty = () => {
        if (hasFilters) {
            return (
                <EmptyState
                    icon="search_off"
                    title={t('jobs.empty.filteredTitle')}
                    description={t('jobs.empty.filteredText')}
                    action={<Button onClick={resetFilters}>{t('jobs.empty.filteredAction')}</Button>}
                />
            );
        }
        if (tab === 'saved') {
            return (
                <EmptyState
                    icon="bookmark_border"
                    title={t('jobs.empty.savedTitle')}
                    description={t('jobs.empty.savedText')}
                    action={<Button onClick={() => changeTab('all')}>{t('jobs.empty.savedAction')}</Button>}
                />
            );
        }
        if (tab === 'matched') {
            return mySkills.length === 0 ? (
                <EmptyState
                    icon="auto_awesome"
                    title={t('jobs.empty.matchedNoSkillsTitle')}
                    description={t('jobs.empty.matchedNoSkillsText')}
                    action={
                        <Link to="/settings">
                            <Button>{t('jobs.empty.matchedNoSkillsAction')}</Button>
                        </Link>
                    }
                />
            ) : (
                <EmptyState
                    icon="auto_awesome"
                    title={t('jobs.empty.matchedTitle')}
                    description={t('jobs.empty.matchedText')}
                    action={<Button onClick={() => changeTab('all')}>{t('jobs.empty.matchedAction')}</Button>}
                />
            );
        }
        return (
            <EmptyState
                icon="work_off"
                title={t('jobs.empty.noneTitle')}
                description={t('jobs.empty.noneText')}
            />
        );
    };

    return (
        <>
            <PageHeader title={t('jobs.page.title')} description={t('jobs.page.description')} />

            <div className="flex flex-col items-start gap-6 lg:flex-row">
                {/* Sol panel: filtrlər */}
                <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-80">
                    <JobFilters
                        values={filterValues}
                        onChange={updateParams}
                        onReset={resetFilters}
                        hasFilters={hasFilters}
                    />
                </aside>

                {/* Sağ tərəf: tab-lar, axtarış və siyahı */}
                <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
                    {isFreelancer && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            <TabButton active={tab === 'all'} onClick={() => changeTab('all')}>
                                {t('jobs.tabs.all')}
                            </TabButton>
                            <TabButton
                                active={tab === 'saved'}
                                icon="bookmark"
                                count={tabCounts?.saved}
                                onClick={() => changeTab('saved')}
                            >
                                {t('jobs.tabs.saved')}
                            </TabButton>
                            <TabButton
                                active={tab === 'matched'}
                                icon="auto_awesome"
                                count={tabCounts?.matched}
                                onClick={() => changeTab('matched')}
                            >
                                {t('jobs.tabs.matched')}
                            </TabButton>
                        </div>
                    )}

                    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
                        <Input
                            className="flex-1"
                            icon="search"
                            label={t('jobs.search.label')}
                            placeholder={t('jobs.search.placeholder')}
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            endAdornment={
                                searchInput ? (
                                    <button
                                        type="button"
                                        aria-label={t('jobs.search.clear')}
                                        onClick={() => setSearchInput('')}
                                        className="rounded-full p-1 text-secondary hover:bg-surface-container"
                                    >
                                        <Icon name="close" className="text-[16px]" />
                                    </button>
                                ) : null
                            }
                        />
                        <Select
                            className="sm:w-52"
                            label={t('jobs.sort.label')}
                            options={sortOptions}
                            value={sort}
                            onChange={(e) => updateParams({ sort: e.target.value === 'newest' ? '' : e.target.value })}
                        />
                    </Card>

                    {/* Aktiv filtr çipləri və nəticə sayı */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-label-sm text-secondary">
                        <div className="flex flex-wrap items-center gap-2">
                            {chips.map((chip) => (
                                <FilterChip
                                    key={chip.key}
                                    label={chip.label}
                                    onRemove={chip.onRemove}
                                    removeLabel={t('jobs.chip.remove', { label: chip.label })}
                                />
                            ))}
                            {chips.length > 1 && (
                                <button type="button" onClick={resetFilters} className="text-label-sm text-primary hover:underline">
                                    {t('common.actions.clear')}
                                </button>
                            )}
                        </div>
                        {pagination && (
                            <span>
                                <strong className="text-on-surface">{pagination.total}</strong>{' '}
                                {t('jobs.counts.job', { count: pagination.total })}
                            </span>
                        )}
                    </div>

                    {isLoading ? (
                        <ListSkeleton />
                    ) : isError ? (
                        <ErrorState
                            title={t('jobs.errors.loadTitle')}
                            description={t('jobs.errors.loadText')}
                            onRetry={refetch}
                        />
                    ) : jobs.length === 0 ? (
                        renderEmpty()
                    ) : (
                        <div className={cn('flex flex-col gap-4 transition-opacity', isFetching && 'opacity-60')}>
                            {jobs.map((job) => (
                                <JobCard key={job.id} job={job} mySkillSlugs={mySkillSlugs} />
                            ))}
                        </div>
                    )}

                    {pagination && pagination.totalPages > 1 && (
                        <Card className="flex flex-col items-center justify-between gap-3 p-4 sm:flex-row">
                            <span className="text-label-md text-secondary">
                                {t('jobs.counts.showing', {
                                    from: (pagination.page - 1) * pagination.limit + 1,
                                    to: (pagination.page - 1) * pagination.limit + jobs.length,
                                    total: pagination.total,
                                })}
                            </span>
                            <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={changePage} />
                        </Card>
                    )}
                </div>
            </div>
        </>
    );
};

export default JobsPage;
