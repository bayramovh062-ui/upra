import { useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button, Card, Icon, Input, Select, Textarea } from '../../components/ui';
import { FieldError } from '../../components/ui/Input';
import { cn } from '../../lib/cn';
import { formatDate, formatMoney } from '../../lib/format';
import { experienceLevels, paymentStructures } from '../../lib/labels';
import { useTranslation } from '../locale/useTranslation';
import {
    MAX_JOB_SKILLS,
    MIN_DEADLINE_DAYS,
    STEPS,
    buildJobPayload,
    createJobSchemas,
    minDeadlineValue,
} from '../../validations/jobSchema';
import SkillPicker from '../taxonomy/SkillPicker';
import { useGetCategoriesQuery } from '../taxonomy/taxonomyApi';

// Elan yaratma və redaktə üçün 3 addımlı wizard (Stitch "Post a job" dizaynı) + canlı önizləmə.
//
//   mode: 'create'    → Publish job / Save as draft
//         'editDraft' → Publish job / Save draft
//         'editOpen'  → Save changes
//   onSubmit(payload, intent): intent = 'publish' | 'draft' | 'save'. Səhifə API sorğusunu göndərir.
const EMPTY = {
    title: '',
    categoryId: '',
    experienceLevel: '',
    description: '',
    skills: [],
    budget: undefined,
    paymentStructure: 'MILESTONES',
    deadline: '',
};

// Radio düymələri kart şəklində (təcrübə səviyyəsi, ödəniş forması)
const OptionCards = ({ label, name, options, hints, value, register, error }) => (
    <fieldset>
        <legend className={cn('mb-1.5 text-label-md', error ? 'text-error' : 'text-on-surface')}>{label}</legend>
        <div className={cn('grid gap-3', options.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
            {options.map((option) => {
                const checked = value === option.value;
                return (
                    <label
                        key={option.value}
                        className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition',
                            'focus-within:ring-2 focus-within:ring-primary-container',
                            checked
                                ? 'border-primary-container bg-primary-fixed/40'
                                : 'border-line bg-surface-container-lowest hover:bg-surface-container-low'
                        )}
                    >
                        <input type="radio" value={option.value} className="sr-only" {...register(name)} />
                        <span
                            className={cn(
                                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                                checked ? 'border-primary-container' : 'border-secondary/50'
                            )}
                        >
                            {checked && <span className="h-2 w-2 rounded-full bg-primary-container" />}
                        </span>
                        <span>
                            <span className="block text-title-md text-on-surface">{option.label}</span>
                            <span className="mt-0.5 block text-caption text-secondary">{hints[option.value]}</span>
                        </span>
                    </label>
                );
            })}
        </div>
        <FieldError>{error}</FieldError>
    </fieldset>
);

const Stepper = ({ step, onGo }) => {
    const { t } = useTranslation();
    return (
        <ol className="flex items-center gap-2">
            {STEPS.map((s, index) => {
                const done = index < step;
                const active = index === step;
                return (
                    <li key={s.key} className="flex flex-1 items-center gap-2 last:flex-none">
                        <button
                            type="button"
                            disabled={index > step}
                            onClick={() => onGo(index)}
                            aria-current={active ? 'step' : undefined}
                            className="flex items-center gap-2 disabled:cursor-default"
                        >
                            <span
                                className={cn(
                                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label-sm font-semibold transition-colors',
                                    done || active
                                        ? 'bg-primary-container text-on-primary'
                                        : 'bg-surface-container text-secondary'
                                )}
                            >
                                {done ? <Icon name="check" className="text-[16px]" /> : index + 1}
                            </span>
                            <span
                                className={cn(
                                    'hidden text-label-md sm:inline',
                                    active ? 'text-on-surface' : 'text-secondary'
                                )}
                            >
                                {t(s.titleKey)}
                            </span>
                        </button>
                        {index < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
                    </li>
                );
            })}
        </ol>
    );
};

const ChecklistItem = ({ done, children }) => (
    <li className="flex items-center gap-2.5">
        <Icon
            name={done ? 'check_circle' : 'radio_button_unchecked'}
            filled={done}
            className={cn('text-[18px]', done ? 'text-primary-container' : 'text-secondary/60')}
        />
        <span className={done ? 'text-on-surface' : 'text-secondary'}>{children}</span>
    </li>
);

const JobForm = ({ defaultValues = EMPTY, mode = 'create', onSubmit, submitting = false, cancelTo }) => {
    const { t } = useTranslation();
    const user = useSelector((state) => state.auth.user);
    const isEdit = mode !== 'create';
    const canDraft = mode !== 'editOpen';
    const primary =
        mode === 'editOpen'
            ? { intent: 'save', label: t('jobs.form.saveChanges') }
            : { intent: 'publish', label: t('jobs.form.publishJob') };
    const draftLabel = mode === 'create' ? t('jobs.form.saveDraft') : t('jobs.form.saveDraftEdit');

    const initialDeadline = defaultValues.deadline ?? '';
    const { jobSchema, draftSchema } = useMemo(
        () => createJobSchemas({ initialDeadline, t }),
        [initialDeadline, t]
    );

    // Draft üçün yumşaq, qalanı üçün sərt sxem. Rejim hər göndərmədən əvvəl dəyişir.
    const validationMode = useRef('publish');
    const resolver = useMemo(() => {
        const strict = zodResolver(jobSchema);
        const lenient = zodResolver(draftSchema);
        return (values, context, options) =>
            (validationMode.current === 'draft' ? lenient : strict)(values, context, options);
    }, [jobSchema, draftSchema]);

    const {
        register,
        control,
        handleSubmit,
        trigger,
        formState: { errors },
    } = useForm({ resolver, defaultValues: { ...EMPTY, ...defaultValues } });

    const [step, setStep] = useState(0);
    const [pending, setPending] = useState(null);
    const busy = submitting || pending !== null;
    const isLast = step === STEPS.length - 1;

    const { data: categoryData, isLoading: categoriesLoading } = useGetCategoriesQuery();
    const categories = categoryData?.categories ?? [];

    const values = useWatch({ control });
    const title = values.title ?? '';
    const description = values.description ?? '';
    const skills = values.skills ?? [];
    const budget = values.budget;
    const hasBudget = Number.isFinite(budget) && budget > 0;
    const categoryName = categories.find((c) => c.id === values.categoryId)?.name;
    const level = experienceLabelLocal(values.experienceLevel, t);
    const payment = paymentLabelLocal(values.paymentStructure, t);

    const goNext = async () => {
        validationMode.current = 'publish';
        if (await trigger(STEPS[step].fields)) setStep((s) => s + 1);
    };

    const run = async (intent) => {
        validationMode.current = intent === 'draft' ? 'draft' : 'publish';
        setPending(intent);
        try {
            await handleSubmit(
                (data) => onSubmit(buildJobPayload(data, { isEdit, initialDeadline }), intent),
                // Xəta başqa addımdadırsa, ilk xətalı addıma qayıt
                (formErrors) => {
                    const firstBad = STEPS.findIndex((s) => s.fields.some((field) => formErrors[field]));
                    if (firstBad !== -1) setStep(firstBad);
                }
            )();
        } finally {
            validationMode.current = 'publish';
            setPending(null);
        }
    };

    const stepText = [
        { title: t('jobs.form.basicsTitle'), text: t('jobs.form.basicsText') },
        { title: t('jobs.form.scopeTitle'), text: t('jobs.form.scopeText') },
        { title: t('jobs.form.budgetTitle'), text: t('jobs.form.budgetText') },
    ][step];

    const levelHints = {
        ENTRY: t('jobs.form.levelHints.ENTRY'),
        MID: t('jobs.form.levelHints.MID'),
        SENIOR: t('jobs.form.levelHints.SENIOR'),
    };
    const paymentHints = {
        MILESTONES: t('jobs.form.paymentHints.MILESTONES'),
        LUMP_SUM: t('jobs.form.paymentHints.LUMP_SUM'),
    };

    return (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-7 xl:col-span-8">
                <form
                    noValidate
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (busy) return;
                        if (isLast) run(primary.intent);
                        else goNext();
                    }}
                    className="flex flex-col gap-6 p-5 sm:p-8"
                >
                    <Stepper step={step} onGo={setStep} />

                    <div>
                        <p className="text-label-sm font-semibold uppercase tracking-wider text-secondary">
                            {t('jobs.form.stepOf', { step: step + 1, total: STEPS.length })}
                        </p>
                        <h2 className="mt-1 text-headline-sm text-on-surface">{stepText.title}</h2>
                        <p className="mt-1 text-body-md text-secondary">{stepText.text}</p>
                    </div>

                    {step === 0 && (
                        <div className="flex flex-col gap-6">
                            <div>
                                <Input
                                    label={t('jobs.form.titleLabel')}
                                    placeholder={t('jobs.form.titlePlaceholder')}
                                    maxLength={120}
                                    hint={t('jobs.form.titleHint')}
                                    error={errors.title?.message}
                                    {...register('title')}
                                />
                                <p className="mt-1 text-right text-caption text-secondary tabular">
                                    {title.length} / 120
                                </p>
                            </div>

                            <Select
                                label={t('jobs.form.categoryLabel')}
                                placeholder={
                                    categoriesLoading
                                        ? t('jobs.form.categoryLoading')
                                        : t('jobs.form.categoryPlaceholder')
                                }
                                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                                error={errors.categoryId?.message}
                                {...register('categoryId')}
                            />

                            <OptionCards
                                label={t('jobs.form.experienceLabel')}
                                name="experienceLevel"
                                options={experienceLevels()}
                                hints={levelHints}
                                value={values.experienceLevel}
                                register={register}
                                error={errors.experienceLevel?.message}
                            />
                        </div>
                    )}

                    {step === 1 && (
                        <div className="flex flex-col gap-6">
                            <div>
                                <Textarea
                                    label={t('jobs.form.descriptionLabel')}
                                    rows={9}
                                    maxLength={3000}
                                    placeholder={t('jobs.form.descriptionPlaceholder')}
                                    hint={t('jobs.form.descriptionHint')}
                                    error={errors.description?.message}
                                    {...register('description')}
                                />
                                <p className="mt-1 text-right text-caption text-secondary tabular">
                                    {description.length} / 3,000
                                </p>
                            </div>

                            <Controller
                                control={control}
                                name="skills"
                                render={({ field }) => (
                                    <div>
                                        <span className="mb-1.5 block text-label-md text-on-surface">
                                            {t('jobs.form.skillsLabel')}
                                        </span>
                                        <SkillPicker
                                            value={field.value ?? []}
                                            onChange={field.onChange}
                                            max={MAX_JOB_SKILLS}
                                            placeholder={t('jobs.form.skillsPlaceholder')}
                                        />
                                        <FieldError>{errors.skills?.message}</FieldError>
                                    </div>
                                )}
                            />
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col gap-6">
                            <Input
                                label={t('jobs.form.budgetLabel')}
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="1"
                                icon="attach_money"
                                placeholder="1000.00"
                                hint={t('jobs.form.budgetHint')}
                                error={errors.budget?.message}
                                {...register('budget', { valueAsNumber: true })}
                            />

                            <OptionCards
                                label={t('jobs.form.paymentLabel')}
                                name="paymentStructure"
                                options={paymentStructures()}
                                hints={paymentHints}
                                value={values.paymentStructure}
                                register={register}
                                error={errors.paymentStructure?.message}
                            />

                            <Input
                                label={t('jobs.form.deadlineLabel')}
                                type="date"
                                min={minDeadlineValue()}
                                hint={t('jobs.form.deadlineHint', { days: MIN_DEADLINE_DAYS })}
                                error={errors.deadline?.message}
                                {...register('deadline')}
                            />
                        </div>
                    )}

                    <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                        {step === 0 ? (
                            <Link to={cancelTo}>
                                <Button variant="ghost" className="w-full sm:w-auto">
                                    {t('jobs.form.cancel')}
                                </Button>
                            </Link>
                        ) : (
                            <Button variant="ghost" disabled={busy} onClick={() => setStep((s) => s - 1)}>
                                <Icon name="arrow_back" className="text-[18px]" />
                                {t('jobs.form.back')}
                            </Button>
                        )}

                        <div className="flex flex-col-reverse gap-3 sm:flex-row">
                            {canDraft && (
                                <Button
                                    variant="secondary"
                                    loading={pending === 'draft'}
                                    disabled={busy}
                                    onClick={() => run('draft')}
                                >
                                    {draftLabel}
                                </Button>
                            )}
                            {isLast ? (
                                <Button
                                    size="lg"
                                    loading={pending === primary.intent}
                                    disabled={busy}
                                    onClick={() => run(primary.intent)}
                                >
                                    {primary.label}
                                </Button>
                            ) : (
                                <Button size="lg" disabled={busy} onClick={goNext}>
                                    {t('jobs.form.next')}
                                    <Icon name="arrow_forward" className="text-[18px]" />
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </Card>

            {/* Canlı önizləmə: frilanserin siyahıda necə görəcəyi */}
            <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-5 xl:col-span-4">
                <Card className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-title-md text-on-surface">
                            <Icon name="visibility" className="text-primary-container" />
                            {t('jobs.form.previewTitle')}
                        </h2>
                        <span className="rounded-full bg-secondary-container px-2 py-0.5 text-caption text-on-secondary-container">
                            {t('jobs.form.freelancerView')}
                        </span>
                    </div>

                    <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            {categoryName && (
                                <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-caption font-semibold text-on-secondary-container">
                                    {categoryName}
                                </span>
                            )}
                            {payment && (
                                <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-caption font-semibold text-on-primary-fixed">
                                    {payment}
                                </span>
                            )}
                            <span className="text-caption text-secondary">{t('jobs.form.postedJustNow')}</span>
                        </div>

                        <h3 className="break-words text-title-md text-on-surface">
                            {title.trim() || t('jobs.form.previewTitlePlaceholder')}
                        </h3>

                        <p className="tabular rounded-lg bg-surface-container-lowest px-3 py-2 text-headline-sm text-on-surface">
                            {hasBudget ? formatMoney(budget) : t('jobs.form.previewBudgetPlaceholder')}
                            <span className="ml-2 text-caption font-normal text-secondary">
                                {t('jobs.card.fixedBudget')}
                            </span>
                        </p>

                        <p className="line-clamp-3 whitespace-pre-line break-words text-body-md text-secondary">
                            {description.trim() || t('jobs.form.previewDescriptionPlaceholder')}
                        </p>

                        {skills.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {skills.map((name) => (
                                    <span
                                        key={name}
                                        className="rounded bg-surface-container-lowest px-2.5 py-1 text-caption text-on-surface"
                                    >
                                        {name}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-label-sm text-secondary">
                            <span className="flex items-center gap-1">
                                <Icon name="person" className="text-[16px]" />
                                {user?.fullName} · {t('jobs.form.previewProposals')}
                            </span>
                            {level && (
                                <span className="flex items-center gap-1">
                                    <Icon name="military_tech" className="text-[15px]" />
                                    {level}
                                </span>
                            )}
                            {values.deadline && (
                                <span className="flex items-center gap-1">
                                    <Icon name="event" className="text-[15px]" />
                                    {t('jobs.form.previewDue', { date: formatDate(values.deadline) })}
                                </span>
                            )}
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <h3 className="mb-3 flex items-center gap-2 text-title-md text-on-surface">
                        <Icon name="checklist" className="text-primary-container" />
                        {t('jobs.form.readyTitle')}
                    </h3>
                    <ul className="flex flex-col gap-2.5 text-body-md">
                        <ChecklistItem done={title.trim().length >= 5}>{t('jobs.form.checklistTitle')}</ChecklistItem>
                        <ChecklistItem done={Boolean(values.categoryId)}>{t('jobs.form.checklistCategory')}</ChecklistItem>
                        <ChecklistItem done={Boolean(values.experienceLevel)}>
                            {t('jobs.form.checklistExperience')}
                        </ChecklistItem>
                        <ChecklistItem done={description.trim().length >= 20}>
                            {t('jobs.form.checklistDescription')}
                        </ChecklistItem>
                        <ChecklistItem done={skills.length > 0}>{t('jobs.form.checklistSkill')}</ChecklistItem>
                        <ChecklistItem done={hasBudget}>{t('jobs.form.checklistBudget')}</ChecklistItem>
                    </ul>
                    {canDraft && (
                        <p className="mt-4 text-caption text-secondary">{t('jobs.form.draftHint')}</p>
                    )}
                </Card>
            </div>
        </div>
    );
};

// `experienceLabel` / `paymentLabel` qlobal `translate` işlədir; burada komponentin `t`-si ilə eyni
// dəyəri almaq üçün kiçik köməkçilər saxlanılır.
const experienceLabelLocal = (value, t) => (value ? t(`labels.experience.${value}`) : null);
const paymentLabelLocal = (value, t) => (value ? t(`labels.payment.${value}`) : null);

export default JobForm;
