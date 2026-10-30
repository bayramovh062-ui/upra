import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Card, EmptyState, ErrorState, Icon, Input, PageHeader, Pagination, Select, Skeleton } from '../components/ui';
import JobCard from '../features/jobs/JobCard';
import { useGetJobsQuery } from '../features/jobs/jobsApi';
import { formatMoney } from '../lib/format';
import { useDebounce } from '../lib/useDebounce';

const PAGE_SIZE = 10;

const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest first' },
    { value: 'budget_desc', label: 'Budget: high to low' },
    { value: 'budget_asc', label: 'Budget: low to high' },
];

const BUDGET_PRESETS = [
    { label: 'Under $500', min: '', max: '500' },
    { label: '$500 – $2,000', min: '500', max: '2000' },
    { label: '$2,000 – $10,000', min: '2000', max: '10000' },
    { label: '$10,000+', min: '10000', max: '' },
];

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

// Frilanser üçün "Find work" (Stitch find_work dizaynı).
// Bütün filtrlər URL-də saxlanılır: səhifəni yeniləyəndə və ya linki göndərəndə nəticə eyni qalır.
const JobsPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const sort = SORT_OPTIONS.some((o) => o.value === searchParams.get('sort')) ? searchParams.get('sort') : 'newest';
    const search = searchParams.get('search') || '';
    const minBudget = searchParams.get('minBudget') || '';
    const maxBudget = searchParams.get('maxBudget') || '';

    // Axtarış və büdcə sahələri lokal state-dir, URL-ə debounce ilə yazılır
    const [searchInput, setSearchInput] = useState(search);
    const [minInput, setMinInput] = useState(minBudget);
    const [maxInput, setMaxInput] = useState(maxBudget);
    const debouncedSearch = useDebounce(searchInput, 400);

    const updateParams = (patch, { keepPage = false } = {}) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                Object.entries(patch).forEach(([key, value]) => {
                    if (value === '' || value === null || value === undefined) next.delete(key);
                    else next.set(key, String(value));
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
        ...(search && { search }),
        ...(minBudget && { minBudget }),
        ...(maxBudget && { maxBudget }),
    });

    const jobs = data?.jobs ?? [];
    const pagination = data?.pagination;
    const hasFilters = Boolean(search || minBudget || maxBudget);

    const applyBudget = () => {
        if (minInput && maxInput && Number(minInput) > Number(maxInput)) {
            toast.error('Minimum budget cannot be greater than maximum');
            return;
        }
        updateParams({ minBudget: minInput, maxBudget: maxInput });
    };

    const applyPreset = (preset) => {
        setMinInput(preset.min);
        setMaxInput(preset.max);
        updateParams({ minBudget: preset.min, maxBudget: preset.max });
    };

    const resetAll = () => {
        setSearchInput('');
        setMinInput('');
        setMaxInput('');
        setSearchParams({}, { replace: true });
    };

    const changePage = (nextPage) => {
        updateParams({ page: nextPage }, { keepPage: true });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const budgetLabel = () => {
        if (minBudget && maxBudget) return `${formatMoney(minBudget)} – ${formatMoney(maxBudget)}`;
        if (minBudget) return `From ${formatMoney(minBudget)}`;
        return `Up to ${formatMoney(maxBudget)}`;
    };

    return (
        <>
            <PageHeader
                title="Find work"
                description="Browse open jobs, send a proposal and start working on a shared Kanban board."
            />

            <div className="flex flex-col items-start gap-6 lg:flex-row">
                {/* Sol panel: filtrlər */}
                <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-72">
                    <Card className="flex flex-col gap-5 p-5">
                        <div className="flex items-center justify-between">
                            <h2 className="flex items-center gap-2 text-title-md text-on-surface">
                                <Icon name="tune" className="text-primary-container" />
                                Filters
                            </h2>
                            {hasFilters && (
                                <button
                                    type="button"
                                    onClick={resetAll}
                                    className="text-label-sm text-secondary transition-colors hover:text-primary-container"
                                >
                                    Reset all
                                </button>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            <span className="text-label-md text-on-surface">Budget (USD)</span>
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="Min"
                                    aria-label="Minimum budget"
                                    value={minInput}
                                    onChange={(e) => setMinInput(e.target.value)}
                                />
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="Max"
                                    aria-label="Maximum budget"
                                    value={maxInput}
                                    onChange={(e) => setMaxInput(e.target.value)}
                                />
                            </div>
                            <Button variant="secondary" size="sm" onClick={applyBudget}>
                                Apply budget
                            </Button>
                            <div className="flex flex-wrap gap-1.5">
                                {BUDGET_PRESETS.map((preset) => {
                                    const active = minBudget === preset.min && maxBudget === preset.max;
                                    return (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => applyPreset(preset)}
                                            className={
                                                active
                                                    ? 'rounded-full bg-primary-container px-2.5 py-1 text-caption text-on-primary'
                                                    : 'rounded-full bg-surface-container-low px-2.5 py-1 text-caption text-secondary transition-colors hover:bg-surface-container'
                                            }
                                        >
                                            {preset.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </Card>
                </aside>

                {/* Sağ tərəf: axtarış və siyahı */}
                <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
                    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
                        <Input
                            className="flex-1"
                            icon="search"
                            label="Search"
                            placeholder="Search by title or description..."
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
                            {search && (
                                <FilterChip
                                    label={`“${search}”`}
                                    onRemove={() => {
                                        setSearchInput('');
                                        updateParams({ search: '' });
                                    }}
                                />
                            )}
                            {(minBudget || maxBudget) && (
                                <FilterChip
                                    label={budgetLabel()}
                                    onRemove={() => {
                                        setMinInput('');
                                        setMaxInput('');
                                        updateParams({ minBudget: '', maxBudget: '' });
                                    }}
                                />
                            )}
                        </div>
                        {pagination && (
                            <span>
                                <strong className="text-on-surface">{pagination.total}</strong>{' '}
                                {pagination.total === 1 ? 'open job' : 'open jobs'}
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
                        <EmptyState
                            icon="search_off"
                            title={hasFilters ? 'No jobs match your search' : 'No open jobs yet'}
                            description={
                                hasFilters
                                    ? 'Try a different keyword or widen the budget range.'
                                    : 'New jobs will appear here as soon as clients post them.'
                            }
                            action={hasFilters && <Button onClick={resetAll}>Reset all filters</Button>}
                        />
                    ) : (
                        <div className={isFetching ? 'flex flex-col gap-4 opacity-60 transition-opacity' : 'flex flex-col gap-4'}>
                            {jobs.map((job) => (
                                <JobCard key={job.id} job={job} />
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

const FilterChip = ({ label, onRemove }) => (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-caption text-on-surface">
        {label}
        <button type="button" onClick={onRemove} aria-label="Remove filter" className="flex items-center hover:text-primary-container">
            <Icon name="close" className="text-[13px]" />
        </button>
    </span>
);

export default JobsPage;
