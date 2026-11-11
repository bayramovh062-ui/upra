import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    ErrorState,
    Icon,
    PageHeader,
    Skeleton,
    StatusBadge,
} from '../components/ui';
import { useDeleteProposalMutation, useGetMyProposalsQuery } from '../features/proposals/proposalsApi';
import { useAcceptContractMutation, useDeclineContractMutation } from '../features/contracts/contractsApi';
import { isPendingOffer } from '../features/contracts/contractOffer';
import { useTranslation } from '../features/locale/useTranslation';
import { formatDate, formatMoney, getErrorMessage } from '../lib/format';

const MyProposalsPage = () => {
    const { t } = useTranslation();
    const { data, isLoading, isError, refetch } = useGetMyProposalsQuery();
    const [deleteProposal, { isLoading: withdrawing }] = useDeleteProposalMutation();
    const [target, setTarget] = useState(null);
    // Client təklif göndərib: frilanser workspace-dən əvvəl burada qəbul/rədd edir. { type: 'accept' | 'decline', proposal }
    const [offerAction, setOfferAction] = useState(null);
    const [acceptContract, { isLoading: accepting }] = useAcceptContractMutation();
    const [declineContract, { isLoading: declining }] = useDeclineContractMutation();

    const proposals = data?.proposals ?? [];

    const handleWithdraw = async () => {
        try {
            await deleteProposal({ id: target.id, jobPostId: target.jobPost?.id }).unwrap();
            toast.success(t('proposals.mine.withdrawn'));
            setTarget(null);
        } catch (err) {
            toast.error(getErrorMessage(err, t('proposals.mine.errorWithdraw')));
        }
    };

    const handleOffer = async () => {
        const { type, proposal } = offerAction;
        try {
            if (type === 'accept') {
                await acceptContract(proposal.contract.id).unwrap();
                toast.success(t('proposals.mine.offerAccepted'));
            } else {
                await declineContract(proposal.contract.id).unwrap();
                toast.success(t('proposals.mine.offerDeclined'));
            }
            setOfferAction(null);
        } catch (err) {
            toast.error(getErrorMessage(err, t('proposals.mine.errorOffer')));
        }
    };

    return (
        <>
            <PageHeader title={t('proposals.mine.title')} description={t('proposals.mine.description')} />

            {isLoading ? (
                <div className="flex flex-col gap-3">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-28 w-full" />
                    ))}
                </div>
            ) : isError ? (
                <ErrorState title={t('proposals.mine.loadError')} onRetry={refetch} />
            ) : proposals.length === 0 ? (
                <EmptyState
                    icon="description"
                    title={t('proposals.mine.emptyTitle')}
                    description={t('proposals.mine.emptyText')}
                    action={
                        <Link to="/jobs">
                            <Button>{t('proposals.mine.findWork')}</Button>
                        </Link>
                    }
                />
            ) : (
                <div className="flex flex-col gap-3">
                    {proposals.map((p) => {
                        // Təklifin statusu qəbul olunandan sonra dəyişmir; real vəziyyət müqavilədədir
                        const contractStatus = p.contract?.status;
                        const displayStatus = p.status === 'ACCEPTED' && contractStatus ? contractStatus : p.status;
                        const offerPending = isPendingOffer(contractStatus);
                        return (
                        <Card key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                            <div className="min-w-0 flex-1">
                                <Link
                                    to={`/jobs/${p.jobPost?.id}`}
                                    className="block truncate text-title-md text-on-surface hover:text-primary-container"
                                >
                                    {p.jobPost?.title}
                                </Link>
                                <p className="mt-1 text-caption text-secondary">
                                    {t('proposals.mine.sentOn', {
                                        date: formatDate(p.createdAt),
                                        budget: formatMoney(p.jobPost?.budget),
                                    })}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-caption text-secondary">{t('proposals.mine.yourBid')}</p>
                                <p className="tabular text-title-md font-semibold text-on-surface">
                                    {formatMoney(p.bidAmount)}
                                </p>
                            </div>
                            <StatusBadge status={displayStatus} />
                            <div className="flex gap-2">
                                {p.status === 'PENDING' && p.jobPost?.status === 'OPEN' && (
                                    <>
                                        <Link to={`/jobs/${p.jobPost.id}`}>
                                            <Button variant="secondary" size="sm">
                                                <Icon name="edit" className="text-[16px]" />
                                                {t('proposals.mine.edit')}
                                            </Button>
                                        </Link>
                                        <Button variant="ghost" size="sm" onClick={() => setTarget(p)}>
                                            {t('proposals.mine.withdraw')}
                                        </Button>
                                    </>
                                )}
                                {offerPending && p.contract?.id && (
                                    <>
                                        <Button variant="ghost" size="sm" onClick={() => setOfferAction({ type: 'decline', proposal: p })}>
                                            {t('proposals.mine.decline')}
                                        </Button>
                                        <Button size="sm" onClick={() => setOfferAction({ type: 'accept', proposal: p })}>
                                            <Icon name="task_alt" className="text-[16px]" />
                                            {t('proposals.mine.acceptOffer')}
                                        </Button>
                                    </>
                                )}
                                {p.status === 'ACCEPTED' && contractStatus === 'ACTIVE' && p.contract?.id && (
                                    <Link to={`/contracts/${p.contract.id}`}>
                                        <Button size="sm">
                                            <Icon name="view_kanban" className="text-[16px]" />
                                            {t('proposals.mine.openWorkspace')}
                                        </Button>
                                    </Link>
                                )}
                                {p.status === 'ACCEPTED' && ['COMPLETED', 'CANCELLED'].includes(contractStatus) && p.contract?.id && (
                                    <Link to={`/contracts/${p.contract.id}`}>
                                        <Button variant="secondary" size="sm">
                                            {t('proposals.mine.viewContract')}
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </Card>
                        );
                    })}
                </div>
            )}

            <ConfirmDialog
                open={!!offerAction}
                onClose={() => setOfferAction(null)}
                onConfirm={handleOffer}
                loading={accepting || declining}
                variant={offerAction?.type === 'decline' ? 'danger' : 'primary'}
                title={
                    offerAction?.type === 'decline'
                        ? t('proposals.mine.confirmDeclineTitle')
                        : t('proposals.mine.confirmAcceptTitle')
                }
                message={
                    offerAction?.type === 'decline'
                        ? t('proposals.mine.confirmDeclineText')
                        : t('proposals.mine.confirmAcceptText')
                }
                confirmText={
                    offerAction?.type === 'decline'
                        ? t('proposals.mine.declineOffer')
                        : t('proposals.mine.acceptOffer')
                }
            />

            <ConfirmDialog
                open={!!target}
                onClose={() => setTarget(null)}
                onConfirm={handleWithdraw}
                loading={withdrawing}
                variant="danger"
                title={t('proposals.mine.confirmWithdrawTitle')}
                message={t('proposals.mine.confirmWithdrawText')}
                confirmText={t('proposals.mine.withdraw')}
            />
        </>
    );
};

export default MyProposalsPage;
