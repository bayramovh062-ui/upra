import { formatCents } from '../../lib/format';
import { cn } from '../../lib/cn';
import { useTranslation } from '../locale/useTranslation';
import { COMMISSION_PERCENT, netCents } from './escrowUtils';

// Frilanserə komissiyanı açıq göstərir: "Siz $45.00 alırsınız · $50.00 − $5.00 platforma haqqı (10%)".
// grossCents: client-in ödədiyi məbləğ. netTotalCents: verilməsə, tək məbləğ kimi hesablanır;
// bir neçə mərhələ üçün planTotals().netTotalCents ötürülür (hər mərhələdən ayrıca yuvarlaqlaşdırılır, backend kimi).
// compact: kartlarda bir sətirlik qısa variant ("≈ $45.00 after the 10% platform fee").
const FeeBreakdown = ({ grossCents, netTotalCents, compact = false, className }) => {
    const { t } = useTranslation();

    if (!Number.isFinite(grossCents) || grossCents <= 0) return null;

    const net = netTotalCents ?? netCents(grossCents);
    const fee = grossCents - net;

    if (compact) {
        return (
            <p className={cn('tabular text-caption text-secondary', className)}>
                {t('escrow.fee.compact', { net: formatCents(net), percent: COMMISSION_PERCENT })}
            </p>
        );
    }

    return (
        <p className={cn('text-label-md', className)}>
            <span className="tabular font-semibold text-success-ink">
                {t('escrow.fee.youReceive', { net: formatCents(net) })}
            </span>
            <span className="tabular text-secondary">
                {' · '}
                {t('escrow.fee.breakdown', {
                    gross: formatCents(grossCents),
                    fee: formatCents(fee),
                    percent: COMMISSION_PERCENT,
                })}
            </span>
        </p>
    );
};

export default FeeBreakdown;
