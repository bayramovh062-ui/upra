import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button, Card, Icon, Input, StatusBadge, Textarea } from '../../components/ui';
import { formatMoney } from '../../lib/format';
import { jobSchema } from '../../validations/jobSchema';

// Elan yaratma və redaktə üçün ortaq forma (Stitch "Post a job" dizaynı).
// Dizaynda olan kateqoriya, bacarıqlar, deadline və escrow sahələri backend-də yoxdur, ona görə burada da yoxdur.
const EMPTY = { title: '', description: '', budget: undefined };

const JobForm = ({ defaultValues = EMPTY, onSubmit, submitting, submitLabel, cancelTo }) => {
    const user = useSelector((state) => state.auth.user);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(jobSchema),
        defaultValues,
    });

    const title = watch('title') ?? '';
    const description = watch('description') ?? '';
    const budget = watch('budget');

    return (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-7 xl:col-span-8">
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6 p-5 sm:p-8">
                    <div>
                        <div className="mb-1.5 flex items-baseline justify-between">
                            <span className="text-label-sm font-semibold uppercase tracking-wider text-secondary">
                                01 · Basics
                            </span>
                            <span className="text-caption text-secondary tabular">{title.length} / 120</span>
                        </div>
                        <Input
                            label="Job title"
                            placeholder="e.g. Build a REST API for a booking app"
                            maxLength={120}
                            hint="Be specific about the technology and what you need built."
                            error={errors.title?.message}
                            {...register('title')}
                        />
                    </div>

                    <div>
                        <div className="mb-1.5 flex items-baseline justify-between">
                            <span className="text-label-sm font-semibold uppercase tracking-wider text-secondary">
                                02 · Scope
                            </span>
                            <span className="text-caption text-secondary tabular">
                                {description.length} / 3,000
                            </span>
                        </div>
                        <Textarea
                            label="Description"
                            rows={9}
                            maxLength={3000}
                            placeholder="Describe the goal, the deliverables and how you will accept the result..."
                            hint="Freelancers read this before sending a proposal. Clear scope means better proposals."
                            error={errors.description?.message}
                            {...register('description')}
                        />
                    </div>

                    <div>
                        <span className="mb-1.5 block text-label-sm font-semibold uppercase tracking-wider text-secondary">
                            03 · Budget
                        </span>
                        <Input
                            label="Fixed budget (USD)"
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
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <Link to={cancelTo}>
                            <Button variant="ghost" className="w-full sm:w-auto">
                                Cancel
                            </Button>
                        </Link>
                        <Button type="submit" size="lg" loading={submitting}>
                            {submitLabel}
                            {!submitting && <Icon name="arrow_forward" className="text-[18px]" />}
                        </Button>
                    </div>
                </form>
            </Card>

            {/* Canlı önizləmə: freelancerin siyahıda necə görəcəyi */}
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
                        <div className="flex items-center gap-2">
                            <StatusBadge status="OPEN" />
                            <span className="text-caption text-secondary">Posted just now</span>
                        </div>
                        <h3 className="break-words text-title-md text-on-surface">
                            {title.trim() || 'Your job title appears here'}
                        </h3>
                        <p className="tabular rounded-lg bg-surface-container-lowest px-3 py-2 text-headline-sm text-on-surface">
                            {Number.isFinite(budget) && budget > 0 ? formatMoney(budget) : '$0.00'}
                            <span className="ml-2 text-caption font-normal text-secondary">Fixed budget</span>
                        </p>
                        <p className="line-clamp-3 whitespace-pre-line break-words text-body-md text-secondary">
                            {description.trim() || 'The start of your description appears here...'}
                        </p>
                        <p className="flex items-center gap-1.5 text-label-sm text-secondary">
                            <Icon name="person" className="text-[16px]" />
                            {user?.fullName} · 0 proposals
                        </p>
                    </div>
                </Card>

                <Card className="p-5">
                    <h3 className="mb-3 flex items-center gap-2 text-title-md text-on-surface">
                        <Icon name="view_kanban" className="text-primary-container" />
                        What happens next
                    </h3>
                    <ul className="flex flex-col gap-3 text-body-md text-secondary">
                        <li className="flex gap-2.5">
                            <Icon name="check_circle" className="mt-0.5 text-[18px] text-primary-container" />
                            Freelancers send proposals with a cover letter and a bid.
                        </li>
                        <li className="flex gap-2.5">
                            <Icon name="check_circle" className="mt-0.5 text-[18px] text-primary-container" />
                            You accept one proposal and a contract starts.
                        </li>
                        <li className="flex gap-2.5">
                            <Icon name="check_circle" className="mt-0.5 text-[18px] text-primary-container" />
                            A Kanban board is created automatically for both of you.
                        </li>
                    </ul>
                </Card>
            </div>
        </div>
    );
};

export default JobForm;
