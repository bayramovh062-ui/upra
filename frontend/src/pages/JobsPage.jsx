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
import { EXPERIENCE_LEVELS, PAYMENT_STRUCTURES, experienceLabel, paymentLabel } from '../lib/labels';
import { toSkillSlug } from '../lib/skills';
import { useDebounce } from '../lib/useDebounce';
import JobCard from '../features/jobs/JobCard';
import JobFilters from '../features/jobs/JobFilters';
import { useGetJobsQuery } from '../features/jobs/jobsApi';
import { useGetCategoriesQuery } from '../features/taxonomy/taxonomyApi';

const PAGE_SIZE = 10;

const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest first' },
    { value: 'budget_desc', label: 'Budget: high to low' },
    { value: 'budget_asc', label: 'Budget: low to high' },
    { value: 'proposals_desc', label: 'Most proposals' },
];

const LEVEL_VALUES = EXPERIENCE_LEVELS.map((l) => l.value);
const PAYMENT_VALUES = PAYMENT_STRUCTURES.map((p) => p.value);

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

const FilterChip = ({ label, onRemove }) => (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-caption text-on-surface">
        {label}
        <button type="button" onClick={onRemove} aria-label={`Remove filter ${label}`} className="flex items-center hover:text-primary-container">
            <Icon name="close" className="text-[13px]" />
        </button>
    </span>
);

// Frilanser üçün "Find work" (Stitch find_work dizaynı).
// Bütün filtrlər URL-də saxlanılır: səhifəni yeniləyəndə və ya linki göndərəndə nəticə eyni qalır.
const JobsPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useSelector((state) => state.auth.user);
    const isFreelancer = user?.role === 'FREELANCER';

    // ---- URL-dən oxu ----
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const sortParam = searchParams.get('sort');
    const sort = SORT_OPTIONS.some((o) => o.value === sortParam) ? sortParam : 'newest';
    const tabParam = searchParams.get('tab');
    // Saved və Matched yalnız frilanser üçündür (backend də client üçün 403 qaytarır)
    const tab = isFreelancer && (tabParam === 'saved' || tabParam === 'matched') ? tabParam : 'all';
    const search = searchParams.get('search') || '';
    const minBudget = searchParams.get('minBudget') || '';
    const maxBudget = searchParams.get('maxBudget') || '';
    const category = csv(searchParams.get('category'));
    const experienceLevel = csv(searchParams.get('experienceLevel')).filter((v) => LEVEL_VALUES.includes(v));
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
        if (minBudget) return `From ${formatMoney(minBudget)}`;
        return `Up to ${formatMoney(maxBudget)}`;
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
                    title="No jobs match your search"
                    description="Try a different keyword, widen the budget range or remove some filters."
                    action={<Button onClick={resetFilters}>Reset all filters</Button>}
                />
            );
        }
        if (tab === 'saved') {
            return (
                <EmptyState
                    icon="bookmark_border"
                    title="No saved jobs yet"
                    description="Tap the bookmark on a job to keep it here for later."
                    action={<Button onClick={() => changeTab('all')}>Browse all jobs</Button>}
                />
            );
        }
        if (tab === 'matched') {
            return mySkills.length === 0 ? (
                <EmptyState
                    icon="auto_awesome"
                    title="Add your skills to see matches"
                    description="Matched jobs are open jobs that require at least one of your skills."
                    action={
                        <Link to="/settings">
                            <Button>Add skills in Settings</Button>
                        </Link>
                    }
                />
            ) : (
                <EmptyState
                    icon="auto_awesome"
                    title="No matching jobs right now"
                    description="No open job requires your skills yet. Check back later or browse all jobs."
                    action={<Button onClick={() => changeTab('all')}>Browse all jobs</Button>}
                />
            );
        }
        return (
            <EmptyState
                icon="work_off"
                title="No open jobs yet"
                description="New jobs will appear here as soon as clients post them."
            />
        );
    };

    return (
        <>
            <PageHeader
                title="Find work"
                description="Browse open jobs, send a proposal and start working on a shared Kanban board."
            />

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
                                All jobs
                            </TabButton>
                            <TabButton
                                active={tab === 'saved'}
                                icon="bookmark"
                                count={tabCounts?.saved}
                                onClick={() => changeTab('saved')}
                            >
                                Saved
                            </TabButton>
                            <TabButton
                                active={tab === 'matched'}
                                icon="auto_awesome"
                                count={tabCounts?.matched}
                                onClick={() => changeTab('matched')}
                            >
                                Matched to your skills
                            </TabButton>
                        </div>
                    )}

                    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
                        <Input
                            className="flex-1"
                            icon="search"
                            label="Search"
                            placeholder="Search by title, description or skill..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            endAdornment={
                                searchInput ? (
                                    <button
                                        type="button"
                                        aria-label="Clear search"
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
                            label="Sort by"
                            options={SORT_OPTIONS}
                            value={sort}
                            onChange={(e) => updateParams({ sort: e.target.value === 'newest' ? '' : e.target.value })}
                        />
                    </Card>

                    {/* Aktiv filtr çipləri və nəticə sayı */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-label-sm text-secondary">
                        <div className="flex flex-wrap items-center gap-2">
                            {chips.map((chip) => (
                                <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
                            ))}
                            {chips.length > 1 && (
                                <button type="button" onClick={resetFilters} className="text-label-sm text-primary hover:underline">
                                    Clear all
                                </button>
                            )}
                        </div>
                        {pagination && (
                            <span>
                                <strong className="text-on-surface">{pagination.total}</strong>{' '}
                                {pagination.total === 1 ? 'job' : 'jobs'}
                            </span>
                        )}
                    </div>

                    {isLoading ? (
                        <ListSkeleton />
                    ) : isError ? (
                        <ErrorState
                            title="Could not load jobs"
                            description="Check your connection and try again."
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
                                Showing{' '}
                                <strong className="text-on-surface">
                                    {(pagination.page - 1) * pagination.limit + 1}–
                                    {(pagination.page - 1) * pagination.limit + jobs.length}
                                </strong>{' '}
                                of <strong className="text-on-surface">{pagination.total}</strong>
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
