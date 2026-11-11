import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Avatar,
    Badge,
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    ErrorState,
    Icon,
    Input,
    Modal,
    PageHeader,
    Pagination,
    Select,
    Skeleton,
    Textarea,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatDate, getErrorMessage } from '../../lib/format';
import { useDebounce } from '../../lib/useDebounce';
import { useTranslation } from '../../features/locale/useTranslation';
import { useGetAdminUsersQuery, useUpdateAdminUserSuspensionMutation } from '../../features/admin/adminApi';

const PAGE_SIZE = 20;

const TABS = [
    { key: 'ALL', labelKey: 'admin.users.tabs.ALL' },
    { key: 'ACTIVE', labelKey: 'admin.users.tabs.ACTIVE' },
    { key: 'SUSPENDED', labelKey: 'admin.users.tabs.SUSPENDED' },
];

const ROLE_VALUES = ['', 'CLIENT', 'FREELANCER', 'ADMIN'];

// Backend sorğu parametrləri (boş filtrlər göndərilmir)
const buildParams = ({ q, role, tab, page }) => ({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    ...(q && { q }),
    ...(role && { role }),
    ...(tab === 'ACTIVE' && { suspended: 'false' }),
    ...(tab === 'SUSPENDED' && { suspended: 'true' }),
});

const SuspendModal = ({ user, onClose }) => {
    const { t } = useTranslation();
    const [reason, setReason] = useState('');
    const [updateSuspension, { isLoading }] = useUpdateAdminUserSuspensionMutation();

    const submit = async () => {
        try {
            await updateSuspension({ id: user.id, suspended: true, reason: reason.trim() || undefined }).unwrap();
            toast.success(t('admin.users.suspendModal.success', { name: user.fullName }));
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err, t('admin.users.suspendModal.error')));
        }
    };

    return (
        <Modal
            open
            onClose={isLoading ? undefined : onClose}
            title={t('admin.users.suspendModal.title')}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                        {t('common.actions.cancel')}
                    </Button>
                    <Button variant="danger" onClick={submit} loading={isLoading}>
                        {t('admin.users.suspendModal.submit')}
                    </Button>
                </>
            }
        >
            <p className="mb-3 break-words rounded-lg bg-surface-container px-3 py-2 text-label-md text-on-surface-variant">
                <span className="font-semibold text-on-surface">{user.fullName}</span> · {user.email}
            </p>
            <p className="mb-3 text-body-md text-secondary">{t('admin.users.suspendModal.description')}</p>
            <Textarea
                label={t('admin.users.suspendModal.reason')}
                rows={3}
                maxLength={500}
                value={reason}
                disabled={isLoading}
                onChange={(e) => setReason(e.target.value)}
                hint={t('admin.users.suspendModal.reasonHint')}
            />
        </Modal>
    );
};

const UserRow = ({ user, onSuspend, onReinstate }) => {
    const { t } = useTranslation();

    return (
        <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
                <Avatar name={user.fullName} size="md" />
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-body-md font-medium text-on-surface">{user.fullName}</p>
                        <Badge tone={user.role === 'ADMIN' ? 'brand' : 'gray'}>
                            {t(`common.roles.${user.role}`)}
                        </Badge>
                        {user.isSuspended && <Badge tone="red">{t('common.status.SUSPENDED')}</Badge>}
                    </div>
                    <p className="truncate text-caption text-secondary">
                        {user.email} · {t('admin.users.joined', { date: formatDate(user.createdAt) })}
                    </p>
                    {user.isSuspended && (
                        <p className="mt-1 break-words text-caption text-danger-ink">
                            {t('admin.users.suspendedOn', { date: formatDate(user.suspendedAt) })}
                            {user.suspendedByAdmin?.fullName
                                ? t('admin.users.suspendedBy', { name: user.suspendedByAdmin.fullName })
                                : ''}
                            {user.suspensionReason ? ` · ${user.suspensionReason}` : ''}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <Link to={`/users/${user.id}`}>
                    <Button size="sm" variant="ghost">
                        {t('admin.users.viewProfile')}
                    </Button>
                </Link>
                {user.role === 'ADMIN' ? (
                    <span className="px-2 text-caption text-secondary">{t('admin.users.protected')}</span>
                ) : user.isSuspended ? (
                    <Button size="sm" variant="secondary" onClick={() => onReinstate(user)}>
                        <Icon name="how_to_reg" className="text-[16px]" />
                        {t('admin.users.reinstate')}
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-error hover:bg-error-container"
                        onClick={() => onSuspend(user)}
                    >
                        <Icon name="block" className="text-[16px]" />
                        {t('admin.users.suspend')}
                    </Button>
                )}
            </div>
        </li>
    );
};

const AdminUsersPage = () => {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [role, setRole] = useState('');
    const [tab, setTab] = useState('ALL');
    const [page, setPage] = useState(1);
    const [suspendTarget, setSuspendTarget] = useState(null);
    const [reinstateTarget, setReinstateTarget] = useState(null);

    const roleOptions = ROLE_VALUES.map((value) => ({
        value,
        label: value ? t(`admin.users.roles.${value}`) : t('admin.users.roles.all'),
    }));

    // Hər düymə üçün sorğu getməsin: axtarış 400 ms sonra göndərilir
    const q = useDebounce(search.trim(), 400);

    const { data, isLoading, isFetching, isError, refetch } = useGetAdminUsersQuery(
        buildParams({ q, role, tab, page })
    );
    const [updateSuspension, { isLoading: reinstating }] = useUpdateAdminUserSuspensionMutation();

    const users = data?.users ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    // Son səhifədəki son istifadəçi filtrdən çıxanda (məs. "Suspended" tabında reinstate) boş səhifədə qalmamaq üçün.
    // Effekt yox, render zamanı düzəliş (React-in tövsiyə etdiyi qayda): artıq mövcud olmayan səhifədən geri qayıdır.
    if (totalPages > 0 && page > totalPages) setPage(totalPages);

    const changeFilter = (setter) => (value) => {
        setter(value);
        setPage(1);
    };

    const handleReinstate = async () => {
        try {
            await updateSuspension({ id: reinstateTarget.id, suspended: false }).unwrap();
            toast.success(t('admin.users.reinstateConfirm.success', { name: reinstateTarget.fullName }));
            setReinstateTarget(null);
        } catch (err) {
            toast.error(getErrorMessage(err, t('admin.users.reinstateConfirm.error')));
        }
    };

    return (
        <>
            <PageHeader title={t('admin.users.title')} description={t('admin.users.description')} />

            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="inline-flex flex-wrap gap-1 rounded-xl bg-surface-container-low p-1">
                    {TABS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => changeFilter(setTab)(item.key)}
                            className={cn(
                                'rounded-lg px-4 py-1.5 text-label-md transition-all',
                                tab === item.key
                                    ? 'bg-surface-container-lowest font-semibold text-primary shadow-sm'
                                    : 'text-on-surface-variant hover:text-on-surface',
                            )}
                        >
                            {t(item.labelKey)}
                        </button>
                    ))}
                </div>

                <Input
                    className="min-w-[220px] flex-1"
                    icon="search"
                    type="search"
                    placeholder={t('admin.users.searchPlaceholder')}
                    aria-label={t('admin.users.searchAria')}
                    value={search}
                    onChange={(e) => changeFilter(setSearch)(e.target.value)}
                />

                <Select
                    className="lg:w-48"
                    aria-label={t('admin.users.filterByRole')}
                    value={role}
                    options={roleOptions}
                    onChange={(e) => changeFilter(setRole)(e.target.value)}
                />
            </div>

            {isLoading ? (
                <div className="flex flex-col gap-3">
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                    ))}
                </div>
            ) : isError ? (
                <ErrorState title={t('admin.users.loadError')} onRetry={refetch} />
            ) : users.length === 0 ? (
                <EmptyState
                    icon="group"
                    title={t('admin.users.emptyTitle')}
                    description={t('admin.users.emptyText')}
                />
            ) : (
                <>
                    <p className="mb-2 text-label-md text-secondary">{t('admin.users.count', { count: total })}</p>
                    <Card className={cn('overflow-hidden transition-opacity', isFetching && 'opacity-60')}>
                        <ul className="divide-y divide-line">
                            {users.map((user) => (
                                <UserRow
                                    key={user.id}
                                    user={user}
                                    onSuspend={setSuspendTarget}
                                    onReinstate={setReinstateTarget}
                                />
                            ))}
                        </ul>
                    </Card>
                    <div className="mt-4 flex justify-center">
                        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                    </div>
                </>
            )}

            {suspendTarget && <SuspendModal user={suspendTarget} onClose={() => setSuspendTarget(null)} />}

            <ConfirmDialog
                open={!!reinstateTarget}
                onClose={() => setReinstateTarget(null)}
                onConfirm={handleReinstate}
                loading={reinstating}
                title={t('admin.users.reinstateConfirm.title')}
                message={t('admin.users.reinstateConfirm.message', {
                    name: reinstateTarget?.fullName ?? t('admin.users.thisUser'),
                })}
                confirmText={t('admin.users.reinstateConfirm.confirm')}
            />
        </>
    );
};

export default AdminUsersPage;
