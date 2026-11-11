import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Avatar,
    Button,
    Card,
    EmptyState,
    ErrorState,
    Icon,
    Skeleton,
    StatusBadge,
} from '../components/ui';
import { useGetJobQuery } from '../features/jobs/jobsApi';
import { useGetJobProposalsQuery } from '../features/proposals/proposalsApi';
import { useCreateContractMutation } from '../features/contracts/contractsApi';
import { useOpenConversationMutation } from '../features/chat/chatApi';
import MilestonePlanModal from '../features/escrow/MilestonePlanModal';
import { useTranslation } from '../features/locale/useTranslation';
import { cn } from '../lib/cn';
import { formatMoney, getErrorMessage } from '../lib/format';

const ProposalCard = ({ proposal, budget, canAccept, onAccept, onMessage }) => {
    const { t, timeAgo } = useTranslation();
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
                            <h2 className="truncate text-headline-sm text-on-surface">
                                {f?.id ? (
                                    <Link to={`/users/${f.id}`} className="hover:text-primary hover:underline">
                                        {f.fullName}
                                    </Link>
                                ) : (
                                    f?.fullName
                                )}
                            </h2>
                            <StatusBadge status={proposal.status} />
                        </div>
                        {f?.headline && <p className="mt-0.5 text-body-md text-on-surface">{f.headline}</p>}
                        {f?.hourlyRate != null && (
                            <p className="text-label-sm text-secondary">
                                {t('proposals.jobPage.rate', { rate: formatMoney(f.hourlyRate) })}
                            </p>
                        )}
                    </div>
                </div>
                <span className="text-caption text-secondary">
                    {t('proposals.jobPage.submitted', { time: timeAgo(proposal.createdAt) })}
                </span>
            </div>

            <div className="mt-4 flex flex-wrap items-baseline gap-3 rounded-xl bg-surface-container-low p-4">
                <div>
                    <p className="text-caption uppercase tracking-wider text-secondary">
                        {t('proposals.jobPage.proposedBid')}
                    </p>
                    <p className="tabular text-headline-sm font-bold text-on-surface">{formatMoney(proposal.bidAmount)}</p>
                </div>
                {diff !== 0 && (
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-caption font-semibold',
                            diff < 0 ? 'bg-success-soft text-success-ink' : 'bg-warning-soft text-warning-ink',
                        )}
                    >
                        {diff < 0
                            ? t('proposals.jobPage.underBudget', { amount: formatMoney(Math.abs(diff)) })
                            : t('proposals.jobPage.overBudget', { amount: formatMoney(Math.abs(diff)) })}
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
                        {expanded ? t('proposals.jobPage.showLess') : t('proposals.jobPage.readFull')}
                    </button>
                )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                {f?.id && (
                    <Button variant="secondary" onClick={() => onMessage(proposal)}>
                        <Icon name="chat" className="text-[18px]" />
                        {t('proposals.jobPage.message')}
                    </Button>
                )}
                {proposal.status === 'PENDING' && canAccept && (
                    <Button onClick={() => onAccept(proposal)}>
                        <Icon name="send" className="text-[18px]" />
                        {t('proposals.jobPage.sendOffer')}
                    </Button>
                )}
            </div>
        </Card>
    );
};

const JobProposalsPage = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const [selected, setSelected] = useState(null);

    const jobQ = useGetJobQuery(id);
    const propQ = useGetJobProposalsQuery(id);
    const [createContract, { isLoading: accepting }] = useCreateContractMutation();
    const [openConversation] = useOpenConversationMutation();
    const navigate = useNavigate();

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
                    title={t('proposals.jobPage.notFoundTitle')}
                    description={t('proposals.jobPage.notFoundText')}
                    action={
                        <Link to="/client/jobs">
                            <Button>{t('jobs.detail.backToMyJobs')}</Button>
                        </Link>
                    }
                />
            );
        }
        return (
            <ErrorState
                title={t('proposals.jobPage.loadError')}
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

    // milestones: mərhələ planı (dollarla) və ya undefined = tək "Full delivery" mərhələsi
    const handleAccept = async (milestones) => {
        try {
            await createContract({ proposalId: selected.id, milestones }).unwrap();
            toast.success(t('proposals.jobPage.offerSent'));
            setSelected(null);
        } catch (err) {
            toast.error(getErrorMessage(err, t('proposals.jobPage.errorOffer')));
        }
    };

    const others = proposals.filter((p) => p.status === 'PENDING' && p.id !== selected?.id).length;

    // Freelancer ile daimi sohbeti achir ve mesajlar sehifesine kechir
    const handleMessage = async (proposal) => {
        const otherId = proposal.freelancer?.id;
        if (!otherId) return;
        try {
            const res = await openConversation(otherId).unwrap();
            navigate(`/messages/${res.conversation.id}`);
        } catch (err) {
            toast.error(getErrorMessage(err, t('proposals.jobPage.errorConversation')));
        }
    };

    return (
        <>
            <Link
                to={`/jobs/${job.id}`}
                className="mb-4 inline-flex items-center gap-1 text-label-md text-secondary hover:text-primary-container"
            >
                <Icon name="arrow_back" className="text-[18px]" />
                {t('proposals.jobPage.backToJob')}
            </Link>

            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="break-words text-headline-lg text-on-surface">{job.title}</h1>
                    <p className="mt-1 text-body-md text-secondary">
                        {t('proposals.jobPage.count', { count: proposals.length })} ·{' '}
                        {t('proposals.jobPage.budget', { amount: formatMoney(job.budget) })}
                    </p>
                </div>
                <StatusBadge status={job.status} />
            </div>

            {proposals.length === 0 ? (
                <EmptyState
                    icon="inbox"
                    title={t('proposals.jobPage.emptyTitle')}
                    description={t('proposals.jobPage.emptyText')}
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
                            onMessage={handleMessage}
                        />
                    ))}
                </div>
            )}

            {/* key: hər təklif üçün plan sıfırdan başlayır */}
            {selected && (
                <MilestonePlanModal
                    key={selected.id}
                    open
                    onClose={() => setSelected(null)}
                    onConfirm={handleAccept}
                    loading={accepting}
                    proposal={selected}
                    otherPending={others}
                />
            )}
        </>
    );
};

export default JobProposalsPage;
