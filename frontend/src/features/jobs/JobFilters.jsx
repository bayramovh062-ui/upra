import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Card, Icon, Input, Skeleton } from '../../components/ui';
import { cn } from '../../lib/cn';
import { EXPERIENCE_LEVELS, PAYMENT_STRUCTURES } from '../../lib/labels';
import SkillPicker from '../taxonomy/SkillPicker';
import { useGetCategoriesQuery } from '../taxonomy/taxonomyApi';

export const BUDGET_PRESETS = [
    { label: 'Under $500', min: '', max: '500' },
    { label: '$500 – $2,000', min: '500', max: '2000' },
    { label: '$2,000 – $10,000', min: '2000', max: '10000' },
    { label: '$10,000+', min: '10000', max: '' },
];

const Section = ({ title, aside, children }) => (
    <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface">{title}</span>
            {aside}
        </div>
        {children}
    </div>
);

const checkboxClass = 'h-4 w-4 cursor-pointer rounded accent-primary-container';

// Lokal state yalnız yazı zamanı üçündür. Filtr URL-dən dəyişəndə (Reset, çip silmə) key dəyişir və sahələr təzələnir.
const BudgetFilter = ({ minBudget, maxBudget, onApply }) => {
    const [min, setMin] = useState(minBudget);
    const [max, setMax] = useState(maxBudget);

    const apply = () => {
        if (min && max && Number(min) > Number(max)) {
            toast.error('Minimum budget cannot be greater than maximum');
            return;
        }
        onApply(min, max);
    };

    return (
        <Section title="Budget (USD)">
            <div className="grid grid-cols-2 gap-2">
                <Input
                    type="number"
                    min="0"
                    placeholder="Min"
                    aria-label="Minimum budget"
                    value={min}
                    onChange={(e) => setMin(e.target.value)}
                />
                <Input
                    type="number"
                    min="0"
                    placeholder="Max"
                    aria-label="Maximum budget"
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                />
            </div>
            <Button variant="secondary" size="sm" onClick={apply}>
                Apply budget
            </Button>
            <div className="flex flex-wrap gap-1.5">
                {BUDGET_PRESETS.map((preset) => {
                    const active = minBudget === preset.min && maxBudget === preset.max;
                    return (
                        <button
                            key={preset.label}
                            type="button"
                            onClick={() => onApply(preset.min, preset.max)}
                            className={cn(
                                'rounded-full px-2.5 py-1 text-caption transition-colors',
                                active
                                    ? 'bg-primary-container text-on-primary'
                                    : 'bg-surface-container-low text-secondary hover:bg-surface-container'
                            )}
                        >
                            {preset.label}
                        </button>
                    );
                })}
            </div>
        </Section>
    );
};

const CategoryFilter = ({ selected, onToggle }) => {
    const { data, isLoading, isError } = useGetCategoriesQuery();
    const categories = data?.categories ?? [];

    if (isError) return null;

    return (
        <Section title="Job category">
            {isLoading ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-5 w-full" />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col gap-2 text-body-md">
                    {categories.map((category) => (
                        <label
                            key={category.id}
                            className="flex cursor-pointer items-center justify-between gap-2 text-on-surface"
                        >
                            <span className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    className={checkboxClass}
                                    checked={selected.includes(category.slug)}
                                    onChange={() => onToggle(category.slug)}
                                />
                                {category.name}
                            </span>
                            <span className="tabular text-caption text-secondary">{category.openJobs}</span>
                        </label>
                    ))}
                </div>
            )}
        </Section>
    );
};

// values: { minBudget, maxBudget, category[], experienceLevel[], paymentStructure, skills[], skillsMode }
// onChange(patch): patch-dəki massivlər / sətirlər URL-ə yazılır (boş dəyər = filtr silinir)
const JobFilters = ({ values, onChange, onReset, hasFilters }) => {
    const toggleIn = (list, item) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

    return (
        <Card className="flex flex-col gap-6 p-5">
            <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-title-md text-on-surface">
                    <Icon name="tune" className="text-primary-container" />
                    Filters
                </h2>
                {hasFilters && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="text-label-sm text-secondary transition-colors hover:text-primary-container"
                    >
                        Reset all
                    </button>
                )}
            </div>

            <BudgetFilter
                key={`${values.minBudget}-${values.maxBudget}`}
                minBudget={values.minBudget}
                maxBudget={values.maxBudget}
                onApply={(minBudget, maxBudget) => onChange({ minBudget, maxBudget })}
            />

            <Section title="Payment structure">
                <div className="flex flex-col gap-2 text-body-md">
                    {[{ value: '', label: 'Any' }, ...PAYMENT_STRUCTURES].map((option) => (
                        <label key={option.value || 'any'} className="flex cursor-pointer items-center gap-2 text-on-surface">
                            <input
                                type="radio"
                                name="paymentStructure"
                                className={checkboxClass}
                                checked={values.paymentStructure === option.value}
                                onChange={() => onChange({ paymentStructure: option.value })}
                            />
                            {option.label}
                        </label>
                    ))}
                </div>
            </Section>

            <CategoryFilter
                selected={values.category}
                onToggle={(slug) => onChange({ category: toggleIn(values.category, slug) })}
            />

            <Section title="Experience level">
                <div className="grid grid-cols-3 gap-1">
                    {EXPERIENCE_LEVELS.map((level) => {
                        const active = values.experienceLevel.includes(level.value);
                        return (
                            <button
                                key={level.value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => onChange({ experienceLevel: toggleIn(values.experienceLevel, level.value) })}
                                className={cn(
                                    'rounded px-2 py-1.5 text-center text-label-sm transition-colors',
                                    active
                                        ? 'bg-primary-container font-medium text-on-primary'
                                        : 'bg-surface-container-low text-secondary hover:bg-surface-container'
                                )}
                            >
                                {level.label}
                            </button>
                        );
                    })}
                </div>
            </Section>

            <Section title="Required skills">
                <SkillPicker
                    value={values.skills}
                    onChange={(skills) => onChange({ skills })}
                    allowCreate={false}
                    max={10}
                    placeholder="Search skills..."
                    chipClassName="bg-primary text-on-primary"
                />
                {values.skills.length > 1 && (
                    <label className="flex cursor-pointer items-center gap-2 text-label-md text-on-surface-variant">
                        <input
                            type="checkbox"
                            className={checkboxClass}
                            checked={values.skillsMode === 'all'}
                            onChange={(e) => onChange({ skillsMode: e.target.checked ? 'all' : '' })}
                        />
                        Job must require all of them
                    </label>
                )}
            </Section>

        </Card>
    );
};

export default JobFilters;
