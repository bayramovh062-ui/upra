import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Avatar, Button, Card, Icon, StatusBadge } from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatDate, getErrorMessage } from '../../lib/format';
import { useTranslation } from '../locale/useTranslation';
import { experienceLabel, paymentLabel } from '../../lib/labels';
import { useSaveJobMutation, useUnsaveJobMutation } from './jobsApi';

const BookmarkButton = ({ job }) => {
    const { t } = useTranslation();
    const [saveJob, { isLoading: saving }] = useSaveJobMutation();
    const [unsaveJob, { isLoading: unsaving }] = useUnsaveJobMutation();
    const isSaved = Boolean(job.isSaved);

    const toggle = async () => {
        try {
            await (isSaved ? unsaveJob(job.id) : saveJob(job.id)).unwrap();
        } catch (err) {
            toast.error(getErrorMessage(err, t('jobs.card.saveError')));
        }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            disabled={saving || unsaving}
            aria-pressed={isSaved}
            title={isSaved ? t('jobs.card.removeSaved') : t('jobs.card.saveJob')}
            className={cn(
                'flex items-center justify-center rounded-lg p-2 transition-colors disabled:opacity-60',
                isSaved
                    ? 'bg-primary-fixed text-primary'
                    : 'bg-surface-container-low text-secondary hover:bg-surface-container hover:text-primary'
            )}
        >
            <Icon name={isSaved ? 'bookmark' : 'bookmark_border'} filled={isSaved} className="text-[18px]" />
        </button>
    );
};

// Elanlar siyahısındakı kart (Stitch "Find work" dizaynı).
// job: { id, title, description, budget, status, createdAt, deadline, experienceLevel, paymentStructure,
//        category, skills: [{id,name,slug}], isSaved?, matchScore?, client, _count: { proposals } }
// mySkillSlugs: giriş edən frilanserin bacarıqları (uyğun gələnlər vurğulanır)
const JobCard = ({ job, mySkillSlugs }) => {
    const { t, timeAgo, formatCurrency } = useTranslation();
    const role = useSelector((state) => state.auth.user?.role);
    const isFreelancer = role === 'FREELANCER';
    const proposals = job._count?.proposals ?? 0;
    const skills = job.skills ?? [];
    const level = experienceLabel(job.experienceLevel);
    const payment = paymentLabel(job.paymentStructure);

    return (
        <Card className="group flex flex-col gap-4 p-5 transition-shadow hover:shadow-md sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        {job.status !== 'OPEN' && <StatusBadge status={job.status} />}
                        {job.category && (
                            <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-caption font-semibold text-on-secondary-container">
                                {job.category.name}
                            </span>
                        )}
                        {payment && (
                            <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-caption font-semibold text-on-primary-fixed">
                                {payment}
                            </span>
                        )}
                        {isFreelancer && job.matchScore > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-caption font-semibold text-success-ink">
                                <Icon name="auto_awesome" className="text-[12px]" />
                                {t('jobs.card.match', { score: job.matchScore })}
                            </span>
                        )}
                        <span className="text-caption text-secondary">
                            {t('jobs.card.posted', { time: timeAgo(job.createdAt) })}
                        </span>
                    </div>
                    <Link
                        to={`/jobs/${job.id}`}
                        className="break-words text-headline-sm text-on-surface transition-colors group-hover:text-primary-container"
                    >
                        {job.title}
                    </Link>
                </div>
                <div className="shrink-0 sm:text-right">
                    <p className="tabular text-headline-md text-on-surface">{formatCurrency(job.budget)}</p>
                    <p className="text-caption text-secondary">{t('jobs.card.fixedBudget')}</p>
                </div>
            </div>

            <p className="line-clamp-2 whitespace-pre-line break-words text-body-md text-secondary">
                {job.description}
            </p>

            {skills.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    {skills.map((skill) => {
                        const mine = mySkillSlugs?.has(skill.slug);
                        return (
                            <span
                                key={skill.id}
                                className={cn(
                                    'rounded px-2.5 py-1 text-caption',
                                    mine
                                        ? 'bg-primary-fixed font-semibold text-on-primary-fixed'
                                        : 'bg-surface-container-low text-on-surface'
                                )}
                            >
                                {skill.name}
                            </span>
                        );
                    })}
                </div>
            )}

            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-label-sm text-secondary">
                    {job.client?.fullName && (
                        <span className="flex items-center gap-2 text-on-surface">
                            <Avatar name={job.client.fullName} size="sm" className="h-6 w-6 text-caption" />
                            <span className="text-body-md font-medium">{job.client.fullName}</span>
                        </span>
                    )}
                    {level && (
                        <span className="flex items-center gap-1">
                            <Icon name="military_tech" className="text-[15px]" />
                            {level}
                        </span>
                    )}
                    {job.deadline && (
                        <span className="flex items-center gap-1">
                            <Icon name="event" className="text-[15px]" />
                            {t('jobs.card.due', { date: formatDate(job.deadline) })}
                        </span>
                    )}
                    <span className="flex items-center gap-1">
                        <Icon name="send" className="text-[15px]" />
                        {t('jobs.card.proposals', { count: proposals })}
                    </span>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isFreelancer && <BookmarkButton job={job} />}
                    <Link to={`/jobs/${job.id}`}>
                        <Button size="sm">
                            {t('jobs.card.viewJob')}
                            <Icon name="arrow_forward" className="text-[16px]" />
                        </Button>
                    </Link>
                </div>
            </div>
        </Card>
    );
};

export default JobCard;
