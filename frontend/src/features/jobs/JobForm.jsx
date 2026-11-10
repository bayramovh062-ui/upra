import { useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button, Card, Icon, Input, Select, Textarea } from '../../components/ui';
import { FieldError } from '../../components/ui/Input';
import { cn } from '../../lib/cn';
import { formatDate, formatMoney } from '../../lib/format';
import { EXPERIENCE_LEVELS, PAYMENT_STRUCTURES, experienceLabel, paymentLabel } from '../../lib/labels';
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

const LEVEL_HINTS = {
    ENTRY: 'Early in their career, good for well-defined tasks',
    MID: 'Solid hands-on experience with similar projects',
    SENIOR: 'Deep expertise, works independently and leads decisions',
};

const PAYMENT_HINTS = {
    MILESTONES: 'Pay in stages as the work is delivered',
    LUMP_SUM: 'One payment for the whole job',
};

const STEP_TEXT = [
    {
        title: 'Let’s start with the basics',
        text: 'A clear title and the right category help the right freelancers find your job.',
    },
    {
        title: 'Describe the work',
        text: 'Explain the goal and the deliverables, then pick the skills a freelancer needs.',
    },
    {
        title: 'Budget and timeline',
        text: 'Set what you are willing to pay and when you need the result.',
    },
];

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

const Stepper = ({ step, onGo }) => (
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
                            {s.title}
                        </span>
                    </button>
                    {index < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
                </li>
            );
        })}
    </ol>
);

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
    const user = useSelector((state) => state.auth.user);
    const isEdit = mode !== 'create';
    const canDraft = mode !== 'editOpen';
    const primary =
        mode === 'editOpen'
            ? { intent: 'save', label: 'Save changes' }
            : { intent: 'publish', label: 'Publish job' };
    const draftLabel = mode === 'create' ? 'Save as draft' : 'Save draft';

    const initialDeadline = defaultValues.deadline ?? '';
    const { jobSchema, draftSchema } = useMemo(() => createJobSchemas({ initialDeadline }), [initialDeadline]);

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
    const level = experienceLabel(values.experienceLevel);
    const payment = paymentLabel(values.paymentStructure);

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

    const text = STEP_TEXT[step];

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
                            Step {step + 1} of {STEPS.length}
                        </p>
                        <h2 className="mt-1 text-headline-sm text-on-surface">{text.title}</h2>
                        <p className="mt-1 text-body-md text-secondary">{text.text}</p>
                    </div>

                    {step === 0 && (
                        <div className="flex flex-col gap-6">
                            <div>
                                <Input
                                    label="Job title"
                                    placeholder="e.g. Build a REST API for a booking app"
                                    maxLength={120}
                                    hint="Be specific about the technology and what you need built."
                                    error={errors.title?.message}
                                    {...register('title')}
                                />
                                <p className="mt-1 text-right text-caption text-secondary tabular">
                                    {title.length} / 120
                                </p>
                            </div>

                            <Select
                                label="Category"
                                placeholder={categoriesLoading ? 'Loading categories…' : 'Select a category'}
                                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                                error={errors.categoryId?.message}
                                {...register('categoryId')}
                            />

                            <OptionCards
                                label="Experience level"
                                name="experienceLevel"
                                options={EXPERIENCE_LEVELS}
                                hints={LEVEL_HINTS}
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
                                    label="Description"
                                    rows={9}
                                    maxLength={3000}
                                    placeholder="Describe the goal, the deliverables and how you will accept the result..."
                                    hint="Freelancers read this before sending a proposal. Clear scope means better proposals."
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
                                            Skills required
                                        </span>
                                        <SkillPicker
                                            value={field.value ?? []}
                                            onChange={field.onChange}
                                            max={MAX_JOB_SKILLS}
                                            placeholder="e.g. React, Node.js, PostgreSQL"
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
                                label="Total budget (USD)"
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="1"
                                icon="attach_money"
                                placeholder="1000.00"
                                hint="The total amount you are willing to pay for the whole job."
                                error={errors.budget?.message}
                                {...register('budget', { valueAsNumber: true })}
                            />

                            <OptionCards
                                label="Payment structure"
                                name="paymentStructure"
                                options={PAYMENT_STRUCTURES}
                                hints={PAYMENT_HINTS}
                                value={values.paymentStructure}
                                register={register}
                                error={errors.paymentStructure?.message}
                            />

                            <Input
                                label="Deadline (optional)"
                                type="date"
                                min={minDeadlineValue()}
                                hint={`The date you need the result by. At least ${MIN_DEADLINE_DAYS} days from today.`}
                                error={errors.deadline?.message}
                                {...register('deadline')}
                            />
                        </div>
                    )}

                    <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                        {step === 0 ? (
                            <Link to={cancelTo}>
                                <Button variant="ghost" className="w-full sm:w-auto">
                                    Cancel
                                </Button>
                            </Link>
                        ) : (
                            <Button variant="ghost" disabled={busy} onClick={() => setStep((s) => s - 1)}>
                                <Icon name="arrow_back" className="text-[18px]" />
                                Back
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
                                    Next
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
                            Live preview
                        </h2>
                        <span className="rounded-full bg-secondary-container px-2 py-0.5 text-caption text-on-secondary-container">
                            Freelancer view
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
                            <span className="text-caption text-secondary">Posted just now</span>
                        </div>

                        <h3 className="break-words text-title-md text-on-surface">
                            {title.trim() || 'Your job title appears here'}
                        </h3>

                        <p className="tabular rounded-lg bg-surface-container-lowest px-3 py-2 text-headline-sm text-on-surface">
                            {hasBudget ? formatMoney(budget) : '$0.00'}
                            <span className="ml-2 text-caption font-normal text-secondary">Fixed budget</span>
                        </p>

                        <p className="line-clamp-3 whitespace-pre-line break-words text-body-md text-secondary">
                            {description.trim() || 'The start of your description appears here...'}
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
                                {user?.fullName} · 0 proposals
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
                                    Due {formatDate(values.deadline)}
                                </span>
                            )}
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <h3 className="mb-3 flex items-center gap-2 text-title-md text-on-surface">
                        <Icon name="checklist" className="text-primary-container" />
                        Ready to publish?
                    </h3>
                    <ul className="flex flex-col gap-2.5 text-body-md">
                        <ChecklistItem done={title.trim().length >= 5}>Clear job title</ChecklistItem>
                        <ChecklistItem done={Boolean(values.categoryId)}>Category</ChecklistItem>
                        <ChecklistItem done={Boolean(values.experienceLevel)}>Experience level</ChecklistItem>
                        <ChecklistItem done={description.trim().length >= 20}>Description</ChecklistItem>
                        <ChecklistItem done={skills.length > 0}>At least one skill</ChecklistItem>
                        <ChecklistItem done={hasBudget}>Budget</ChecklistItem>
                    </ul>
                    {canDraft && (
                        <p className="mt-4 text-caption text-secondary">
                            Not ready? Save a draft. Only you can see it until you publish.
                        </p>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default JobForm;
