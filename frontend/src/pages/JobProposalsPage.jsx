import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Avatar,
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    ErrorState,
    Icon,
    Skeleton,
    StatusBadge,
} from '../components/ui';
import { useGetJobQuery } from '../features/jobs/jobsApi';
import { useGetJobProposalsQuery } from '../features/proposals/proposalsApi';
import { useCreateContractMutation } from '../features/contracts/contractsApi';
import { cn } from '../lib/cn';
import { formatMoney, getErrorMessage, timeAgo } from '../lib/format';

const ProposalCard = ({ proposal, budget, canAccept, onAccept }) => {
    const [expanded, setExpanded] = useState(false);
    const f = proposal.freelancer;
    const diff = Number(proposal.bidAmount) - Number(budget);
    const muted = proposal.status === 'REJECTED';

    return (
        <Card className={cn('p-5 sm:p-6', muted && 'opacity-70')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={f?.fullName} size="lg" />
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-headline-sm text-on-surface">{f?.fullName}</h2>
                            <StatusBadge status={proposal.status} />
                        </div>
                        {f?.headline && <p className="mt-0.5 text-body-md text-on-surface">{f.headline}</p>}
                        {f?.hourlyRate != null && (
                            <p className="text-label-sm text-secondary">Profile rate: {formatMoney(f.hourlyRate)}/hr</p>
                        )}
                    </div>
                </div>
                <span className="text-caption text-secondary">Submitted {timeAgo(proposal.createdAt)}</span>
            </div>

            <div className="mt-4 flex flex-wrap items-baseline gap-3 rounded-xl bg-surface-container-low p-4">
                <div>
                    <p className="text-caption uppercase tracking-wider text-secondary">Proposed bid</p>
                    <p className="tabular text-headline-sm font-bold text-on-surface">{formatMoney(proposal.bidAmount)}</p>
                </div>
                {diff !== 0 && (
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-caption font-semibold',
                            diff < 0 ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEF3C7] text-[#92400E]',
                        )}
                    >
                        {formatMoney(Math.abs(diff))} {diff < 0 ? 'under' : 'over'} budget
                    </span>
                )}
            </div>

            <div className="mt-4 rounded-xl bg-surface-container-low p-4">
                <p
                    className={cn(
                        'whitespace-pre-line break-words text-body-md text-on-surface',
                        !expanded && 'line-clamp-3',
                    )}
                >
                    {proposal.coverLetter}
                </p>
                {proposal.coverLetter.length > 160 && (
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        className="mt-2 text-label-sm font-semibold text-primary hover:underline"
                    >
                        {expanded ? 'Show less' : 'Read full cover letter'}
                    </button>
                )}
            </div>

            {proposal.status === 'PENDING' && canAccept && (
                <div className="mt-4">
                    <Button onClick={() => onAccept(proposal)}>
                        <Icon name="bolt" className="text-[18px]" />
                        Accept &amp; start contract
                    </Button>
                </div>
            )}
        </Card>
    );
};

const JobProposalsPage = () => {
    const { id } = useParams();
    const [selected, setSelected] = useState(null);

    const jobQ = useGetJobQuery(id);
    const propQ = useGetJobProposalsQuery(id);
    const [createContract, { isLoading: accepting }] = useCreateContractMutation();

    if (jobQ.isLoading || propQ.isLoading) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (jobQ.isError || propQ.isError) {
        const status = jobQ.error?.status ?? propQ.error?.status;
        if (status === 403 || status === 404) {
            return (
                <EmptyState
                    icon="search_off"
                    title="Job not found"
                    description="This job does not exist or you are not its owner."
                    action={
                        <Link to="/client/jobs">
                            <Button>Back to my jobs</Button>
                        </Link>
                    }
                />
            );
        }
        return (
            <ErrorState
                title="Could not load proposals"
                onRetry={() => {
                    jobQ.refetch();
                    propQ.refetch();
                }}
            />
        );
    }

    const job = jobQ.data.job;
    const proposals = propQ.data?.proposals ?? [];
    const canAccept = job.status === 'OPEN';

    const handleAccept = async () => {
        try {
            await createContract({ proposalId: selected.id }).unwrap();
            toast.success('Contract started. A project board was created.');
            setSelected(null);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not accept the proposal'));
        }
    };

    const others = proposals.filter((p) => p.status === 'PENDING' && p.id !== selected?.id).length;

    return (
        <>
            <Link
                to={`/jobs/${job.id}`}
                className="mb-4 inline-flex items-center gap-1 text-label-md text-secondary hover:text-primary-container"
            >
                <Icon name="arrow_back" className="text-[18px]" />
                Back to job
            </Link>

            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="break-words text-headline-lg text-on-surface">{job.title}</h1>
                    <p className="mt-1 text-body-md text-secondary">
                        {proposals.length} proposal{proposals.length === 1 ? '' : 's'} · Budget {formatMoney(job.budget)}
                    </p>
                </div>
                <StatusBadge status={job.status} />
            </div>

            {proposals.length === 0 ? (
                <EmptyState
                    icon="inbox"
                    title="No proposals yet"
                    description="Freelancers' proposals will appear here."
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {proposals.map((p) => (
                        <ProposalCard
                            key={p.id}
                            proposal={p}
                            budget={job.budget}
                            canAccept={canAccept}
                            onAccept={setSelected}
                        />
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={!!selected}
                onClose={() => setSelected(null)}
                onConfirm={handleAccept}
                loading={accepting}
                title="Accept proposal & start contract?"
                message={`You are about to hire ${selected?.freelancer?.fullName} for ${formatMoney(
                    selected?.bidAmount,
                )}. ${others > 0 ? `The other ${others} pending proposal(s) will be rejected. ` : ''}A project board will be created automatically.`}
                confirmText="Confirm & create board"
            />
        </>
    );
};

export default JobProposalsPage;
