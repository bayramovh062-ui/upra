import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Card, Icon, Input, Skeleton } from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';
import { experienceLevels, paymentStructures } from '../../lib/labels';
import { useTranslation } from '../locale/useTranslation';
import SkillPicker from '../taxonomy/SkillPicker';
import { useGetCategoriesQuery } from '../taxonomy/taxonomyApi';

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
    const { t } = useTranslation();
    const [min, setMin] = useState(minBudget);
    const [max, setMax] = useState(maxBudget);

    const presets = [
        { key: 'under500', label: t('jobs.filters.presetUnder', { amount: formatMoney(500) }), min: '', max: '500' },
        {
            key: '500to2000',
            label: t('jobs.filters.presetBetween', { min: formatMoney(500), max: formatMoney(2000) }),
            min: '500',
            max: '2000',
        },
        {
            key: '2000to10000',
            label: t('jobs.filters.presetBetween', { min: formatMoney(2000), max: formatMoney(10000) }),
            min: '2000',
            max: '10000',
        },
        { key: 'over10000', label: t('jobs.filters.presetOver', { amount: formatMoney(10000) }), min: '10000', max: '' },
    ];

    const apply = () => {
        if (min && max && Number(min) > Number(max)) {
            toast.error(t('jobs.filters.budgetError'));
            return;
        }
        onApply(min, max);
    };

    return (
        <Section title={t('jobs.filters.budget')}>
            <div className="grid grid-cols-2 gap-2">
                <Input
                    type="number"
                    min="0"
                    placeholder={t('jobs.filters.min')}
                    aria-label={t('jobs.filters.minAria')}
                    value={min}
                    onChange={(e) => setMin(e.target.value)}
                />
                <Input
                    type="number"
                    min="0"
                    placeholder={t('jobs.filters.max')}
                    aria-label={t('jobs.filters.maxAria')}
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                />
            </div>
            <Button variant="secondary" size="sm" onClick={apply}>
                {t('jobs.filters.applyBudget')}
            </Button>
            <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => {
                    const active = minBudget === preset.min && maxBudget === preset.max;
                    return (
                        <button
                            key={preset.key}
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
    const { t } = useTranslation();
    const { data, isLoading, isError } = useGetCategoriesQuery();
    const categories = data?.categories ?? [];

    if (isError) return null;

    return (
        <Section title={t('jobs.filters.category')}>
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
    const { t } = useTranslation();
    const toggleIn = (list, item) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

    return (
        <Card className="flex flex-col gap-6 p-5">
            <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-title-md text-on-surface">
                    <Icon name="tune" className="text-primary-container" />
                    {t('jobs.filters.title')}
                </h2>
                {hasFilters && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="text-label-sm text-secondary transition-colors hover:text-primary-container"
                    >
                        {t('jobs.filters.resetAll')}
                    </button>
                )}
            </div>

            <BudgetFilter
                key={`${values.minBudget}-${values.maxBudget}`}
                minBudget={values.minBudget}
                maxBudget={values.maxBudget}
                onApply={(minBudget, maxBudget) => onChange({ minBudget, maxBudget })}
            />

            <Section title={t('jobs.filters.paymentStructure')}>
                <div className="flex flex-col gap-2 text-body-md">
                    {[{ value: '', label: t('jobs.filters.any') }, ...paymentStructures()].map((option) => (
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

            <Section title={t('jobs.filters.experienceLevel')}>
                <div className="grid grid-cols-3 gap-1">
                    {experienceLevels().map((level) => {
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

            <Section title={t('jobs.filters.requiredSkills')}>
                <SkillPicker
                    value={values.skills}
                    onChange={(skills) => onChange({ skills })}
                    allowCreate={false}
                    max={10}
                    placeholder={t('jobs.filters.skillsPlaceholder')}
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
                        {t('jobs.filters.allSkillsRequired')}
                    </label>
                )}
            </Section>

        </Card>
    );
};

export default JobFilters;
