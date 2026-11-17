import { Card, Icon } from '../../components/ui';
import { formatCents, formatDate } from '../../lib/format';
import { useTranslation } from '../locale/useTranslation';
import FeeBreakdown from './FeeBreakdown';
import { netCents, planTotals } from './escrowUtils';

// Gözləyən təklifdə (PENDING_ACCEPTANCE) mərhələ bölgüsü: frilanser qəbul etməzdən əvvəl hər mərhələnin
// məbləğini, tarixini və komissiyadan sonra alacağını görür. Client öz göndərdiyi planı görür.
const OfferMilestonePlan = ({ milestones = [], isFreelancer }) => {
    const { t } = useTranslation();
    const live = milestones.filter((m) => m.status !== 'CANCELLED');
    if (live.length === 0) return null;

    const totals = planTotals(live);

    return (
        <Card className="mb-6 p-5">
            <h2 className="flex items-center gap-2 text-headline-sm text-on-surface">
                <Icon name="flag" className="text-[22px] text-primary-container" />
                {t('escrow.plan.title')}
            </h2>
            <p className="mt-1 text-body-md text-secondary">
                {isFreelancer ? t('escrow.plan.introFreelancer') : t('escrow.plan.introClient')}
            </p>

            <ol className="mt-4 flex flex-col divide-y divide-line">
                {live.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                        <div className="min-w-0">
                            <p className="text-caption uppercase tracking-wider text-secondary">
                                {t('escrow.milestone.number', { number: m.sequence })}
                            </p>
                            <p className="break-words text-title-md text-on-surface">{m.title}</p>
                            <p className="mt-0.5 text-caption text-secondary">
                                {m.dueDate ? t('escrow.plan.due', { date: formatDate(m.dueDate) }) : t('escrow.plan.noDue')}
                                {' · '}
                                {t('escrow.milestone.revisions', { used: m.revisionCount ?? 0, max: m.maxRevisions })}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="tabular text-title-md font-semibold text-on-surface">
                                {formatCents(m.amountCents)}
                            </p>
                            {isFreelancer && (
                                <p className="tabular text-caption text-success-ink">
                                    {t('escrow.plan.net')} {formatCents(netCents(m.amountCents))}
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ol>

            <div className="mt-2 flex flex-col gap-1 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="tabular text-title-md text-on-surface">
                    {t('escrow.plan.total')}: <span className="font-semibold">{formatCents(totals.grossCents)}</span>
                </p>
                {isFreelancer && (
                    <FeeBreakdown grossCents={totals.grossCents} netTotalCents={totals.netTotalCents} />
                )}
            </div>
        </Card>
    );
};

export default OfferMilestonePlan;
