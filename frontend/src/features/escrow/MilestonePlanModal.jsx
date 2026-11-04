import { useState } from 'react';
import { Button, Icon, Input, Modal } from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatCents, formatMoney } from '../../lib/format';

const MAX_MILESTONES = 20; // backend: MAX_MILESTONES
const MAX_TITLE = 120;

let rowSeq = 0;
const newRow = (patch = {}) => ({ key: `r${(rowSeq += 1)}`, title: '', amount: '', dueDate: '', ...patch });

// Dollar yazısını sentə çevirir. Yanlışdırsa NaN (boş, mənfi, 2-dən çox onluq rəqəm)
const toCents = (value) => {
    if (value === '' || value === null || value === undefined) return NaN;
    if (!/^\d+(\.\d{1,2})?$/.test(String(value).trim())) return NaN;
    return Math.round(Number(value) * 100);
};

// Təklif qəbul edilərkən mərhələ planı seçilir. Plan verilməsə backend tam məbləğ üçün tək
// "Full delivery" mərhələsi yaradır. Mərhələlərin cəmi təklifin məbləğinə bərabər olmalıdır.
// onConfirm(milestones | undefined): milestones = [{ title, amount (dollar), dueDate? }]
const MilestonePlanModal = ({ open, onClose, onConfirm, loading, proposal, otherPending = 0 }) => {
    const bidCents = Math.round(Number(proposal?.bidAmount ?? 0) * 100);
    const [split, setSplit] = useState(false);
    const [rows, setRows] = useState([]);
    const [showErrors, setShowErrors] = useState(false);

    const reset = () => {
        setSplit(false);
        setRows([]);
        setShowErrors(false);
    };

    const close = () => {
        if (loading) return;
        reset();
        onClose();
    };

    const enableSplit = () => {
        // Başlanğıc: iki mərhələ, cəmi təklifə bərabər (client sonra dəyişir)
        const first = Math.floor(bidCents / 2);
        setRows([
            newRow({ title: 'Milestone 1', amount: (first / 100).toFixed(2) }),
            newRow({ title: 'Milestone 2', amount: ((bidCents - first) / 100).toFixed(2) }),
        ]);
        setSplit(true);
        setShowErrors(false);
    };

    const disableSplit = () => {
        setSplit(false);
        setRows([]);
        setShowErrors(false);
    };

    const update = (key, patch) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    const remove = (key) => setRows((list) => list.filter((r) => r.key !== key));
    const add = () => setRows((list) => [...list, newRow({ title: `Milestone ${list.length + 1}` })]);

    const amounts = rows.map((r) => toCents(r.amount));
    const sumCents = amounts.reduce((s, c) => s + (Number.isNaN(c) ? 0 : c), 0);
    const diffCents = bidCents - sumCents; // 0 olmalıdır

    const rowError = (r, i) => {
        if (!r.title.trim()) return 'Title is required';
        if (r.title.trim().length > MAX_TITLE) return `Title must be at most ${MAX_TITLE} characters`;
        if (Number.isNaN(amounts[i])) return 'Enter a valid amount (max 2 decimals)';
        if (amounts[i] <= 0) return 'Amount must be greater than 0';
        return '';
    };

    const rowErrors = rows.map(rowError);
    const valid = !split || (rows.length >= 1 && rowErrors.every((e) => !e) && diffCents === 0);

    const submit = () => {
        if (!valid) {
            setShowErrors(true);
            return;
        }
        if (!split) {
            onConfirm(undefined);
            return;
        }
        onConfirm(
            rows.map((r, i) => ({
                title: r.title.trim(),
                amount: amounts[i] / 100,
                ...(r.dueDate ? { dueDate: r.dueDate } : {}),
            })),
        );
    };

    return (
        <Modal
            open={open}
            onClose={close}
            title="Accept proposal & start contract"
            className="max-w-2xl"
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={submit} loading={loading} disabled={showErrors && !valid}>
                        Confirm &amp; create board
                    </Button>
                </>
            }
        >
            <p className="mb-4 text-body-md text-secondary">
                You are about to hire {proposal?.freelancer?.fullName} for {formatMoney(proposal?.bidAmount)}.{' '}
                {otherPending > 0 && `The other ${otherPending} pending proposal(s) will be rejected. `}
                A project board will be created automatically.
            </p>

            <div className="mb-4 inline-flex gap-1 rounded-xl bg-surface-container-low p-1">
                {[
                    { key: false, label: 'One payment' },
                    { key: true, label: 'Split into milestones' },
                ].map((opt) => (
                    <button
                        key={String(opt.key)}
                        type="button"
                        onClick={opt.key ? (split ? undefined : enableSplit) : split ? disableSplit : undefined}
                        className={cn(
                            'rounded-lg px-3 py-1.5 text-label-md transition-all',
                            split === opt.key
                                ? 'bg-surface-container-lowest font-semibold text-primary shadow-sm'
                                : 'text-on-surface-variant hover:text-on-surface',
                        )}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {!split ? (
                <p className="rounded-lg bg-surface-container-low px-3 py-2 text-body-md text-on-surface">
                    A single milestone <span className="font-semibold">Full delivery</span> for{' '}
                    <span className="tabular font-semibold">{formatCents(bidCents)}</span> will be created. You fund it
                    when you are ready, and the freelancer is paid after you approve the work.
                </p>
            ) : (
                <>
                    <div className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto pr-1">
                        {rows.map((r, i) => {
                            const err = showErrors ? rowErrors[i] : '';
                            return (
                                <div
                                    key={r.key}
                                    className="grid grid-cols-1 gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_120px_150px_auto] sm:items-start"
                                >
                                    <Input
                                        label={`Milestone ${i + 1}`}
                                        placeholder="e.g. Design mockups"
                                        maxLength={MAX_TITLE}
                                        value={r.title}
                                        error={err && !r.title.trim() ? err : ''}
                                        onChange={(e) => update(r.key, { title: e.target.value })}
                                    />
                                    <Input
                                        label="Amount (USD)"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        value={r.amount}
                                        error={err && r.title.trim() ? err : ''}
                                        onChange={(e) => update(r.key, { amount: e.target.value })}
                                    />
                                    <Input
                                        label="Due (optional)"
                                        type="date"
                                        value={r.dueDate}
                                        onChange={(e) => update(r.key, { dueDate: e.target.value })}
                                    />
                                    <div className="flex sm:mt-[30px]">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            aria-label={`Remove milestone ${i + 1}`}
                                            disabled={rows.length <= 1}
                                            onClick={() => remove(r.key)}
                                        >
                                            <Icon name="delete" className="text-[18px]" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <Button variant="secondary" size="sm" onClick={add} disabled={rows.length >= MAX_MILESTONES}>
                            <Icon name="add" className="text-[16px]" />
                            Add milestone
                        </Button>
                        <p
                            className={cn(
                                'tabular text-label-md',
                                diffCents === 0 ? 'text-success-ink' : 'text-warning-ink',
                            )}
                        >
                            {formatCents(sumCents)} of {formatCents(bidCents)}
                            {diffCents > 0 && ` · ${formatCents(diffCents)} left to assign`}
                            {diffCents < 0 && ` · ${formatCents(-diffCents)} over`}
                            {diffCents === 0 && ' · matches the bid'}
                        </p>
                    </div>

                    {showErrors && diffCents !== 0 && (
                        <p className="mt-2 text-label-sm text-error">
                            Milestone amounts must add up to the accepted bid ({formatCents(bidCents)}).
                        </p>
                    )}
                </>
            )}
        </Modal>
    );
};

export default MilestonePlanModal;
