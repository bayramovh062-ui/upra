import { Link } from 'react-router-dom';
import { Avatar, Button, Card, Icon, StatusBadge } from '../../components/ui';
import { formatMoney, timeAgo } from '../../lib/format';

// Elanlar siyahısındakı kart (Stitch "Find work" dizaynı).
// job: { id, title, description, budget, status, createdAt, client: { fullName }, _count: { proposals } }
const JobCard = ({ job }) => {
    const proposals = job._count?.proposals ?? 0;

    return (
        <Card className="group p-5 transition-shadow hover:shadow-md sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                    <div className="mb-1.5 flex items-center gap-2">
                        <StatusBadge status={job.status} />
                        <span className="text-caption text-secondary">Posted {timeAgo(job.createdAt)}</span>
                    </div>
                    <Link
                        to={`/jobs/${job.id}`}
                        className="break-words text-headline-sm text-on-surface transition-colors group-hover:text-primary-container"
                    >
                        {job.title}
                    </Link>
                </div>
                <div className="shrink-0 sm:text-right">
                    <p className="tabular text-headline-md text-on-surface">{formatMoney(job.budget)}</p>
                    <p className="text-caption text-secondary">Fixed budget</p>
                </div>
            </div>

            <p className="mt-3 line-clamp-2 whitespace-pre-line break-words text-body-md text-secondary">
                {job.description}
            </p>

            <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-label-sm text-secondary">
                    {job.client?.fullName && (
                        <span className="flex items-center gap-2 text-on-surface">
                            <Avatar name={job.client.fullName} size="sm" className="h-6 w-6 text-caption" />
                            <span className="text-body-md font-medium">{job.client.fullName}</span>
                        </span>
                    )}
                    <span className="flex items-center gap-1">
                        <Icon name="send" className="text-[15px]" />
                        {proposals} {proposals === 1 ? 'proposal' : 'proposals'}
                    </span>
                </div>
                <Link to={`/jobs/${job.id}`} className="self-end sm:self-auto">
                    <Button size="sm">
                        View job
                        <Icon name="arrow_forward" className="text-[16px]" />
                    </Button>
                </Link>
            </div>
        </Card>
    );
};

export default JobCard;
