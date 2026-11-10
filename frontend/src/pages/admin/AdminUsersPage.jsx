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
import { useGetAdminUsersQuery, useUpdateAdminUserSuspensionMutation } from '../../features/admin/adminApi';

const PAGE_SIZE = 20;

const TABS = [
    { key: 'ALL', label: 'All' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'SUSPENDED', label: 'Suspended' },
];

const ROLE_OPTIONS = [
    { value: '', label: 'All roles' },
    { value: 'CLIENT', label: 'Clients' },
    { value: 'FREELANCER', label: 'Freelancers' },
    { value: 'ADMIN', label: 'Admins' },
];

const ROLE_LABEL = { CLIENT: 'Client', FREELANCER: 'Freelancer', ADMIN: 'Admin' };

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
    const [reason, setReason] = useState('');
    const [updateSuspension, { isLoading }] = useUpdateAdminUserSuspensionMutation();

    const submit = async () => {
        try {
            await updateSuspension({ id: user.id, suspended: true, reason: reason.trim() || undefined }).unwrap();
            toast.success(`${user.fullName} was suspended`);
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not suspend the account'));
        }
    };

    return (
        <Modal
            open
            onClose={isLoading ? undefined : onClose}
            title="Suspend account"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={submit} loading={isLoading}>
                        Suspend
                    </Button>
                </>
            }
        >
            <p className="mb-3 break-words rounded-lg bg-surface-container px-3 py-2 text-label-md text-on-surface-variant">
                <span className="font-semibold text-on-surface">{user.fullName}</span> · {user.email}
            </p>
            <p className="mb-3 text-body-md text-secondary">
                The user can no longer sign in or use protected features. Their contracts and escrowed money are not
                changed. You can reinstate the account at any time.
            </p>
            <Textarea
                label="Reason (optional)"
                rows={3}
                maxLength={500}
                value={reason}
                disabled={isLoading}
                onChange={(e) => setReason(e.target.value)}
                hint="The reason is included in the notification the user receives."
            />
        </Modal>
    );
};

const UserRow = ({ user, onSuspend, onReinstate }) => (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
            <Avatar name={user.fullName} size="md" />
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-body-md font-medium text-on-surface">{user.fullName}</p>
                    <Badge tone={user.role === 'ADMIN' ? 'brand' : 'gray'}>{ROLE_LABEL[user.role] || user.role}</Badge>
                    {user.isSuspended && <Badge tone="red">Suspended</Badge>}
                </div>
                <p className="truncate text-caption text-secondary">
                    {user.email} · Joined {formatDate(user.createdAt)}
                </p>
                {user.isSuspended && (
                    <p className="mt-1 break-words text-caption text-danger-ink">
                        Suspended {formatDate(user.suspendedAt)}
                        {user.suspendedByAdmin?.fullName ? ` by ${user.suspendedByAdmin.fullName}` : ''}
                        {user.suspensionReason ? ` · ${user.suspensionReason}` : ''}
                    </p>
                )}
            </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
            <Link to={`/users/${user.id}`}>
                <Button size="sm" variant="ghost">
                    View profile
                </Button>
            </Link>
            {user.role === 'ADMIN' ? (
                <span className="px-2 text-caption text-secondary">Protected</span>
            ) : user.isSuspended ? (
                <Button size="sm" variant="secondary" onClick={() => onReinstate(user)}>
                    <Icon name="how_to_reg" className="text-[16px]" />
                    Reinstate
                </Button>
            ) : (
                <Button
                    size="sm"
                    variant="ghost"
                    className="text-error hover:bg-error-container"
                    onClick={() => onSuspend(user)}
                >
                    <Icon name="block" className="text-[16px]" />
                    Suspend
                </Button>
            )}
        </div>
    </li>
);

const AdminUsersPage = () => {
    const [search, setSearch] = useState('');
    const [role, setRole] = useState('');
    const [tab, setTab] = useState('ALL');
    const [page, setPage] = useState(1);
    const [suspendTarget, setSuspendTarget] = useState(null);
    const [reinstateTarget, setReinstateTarget] = useState(null);

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
            toast.success(`${reinstateTarget.fullName} was reinstated`);
            setReinstateTarget(null);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not reinstate the account'));
        }
    };

    return (
        <>
            <PageHeader
                title="Users"
                description="Search accounts and suspend or reinstate them. Suspended users cannot sign in."
            />

            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="inline-flex flex-wrap gap-1 rounded-xl bg-surface-container-low p-1">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => changeFilter(setTab)(t.key)}
                            className={cn(
                                'rounded-lg px-4 py-1.5 text-label-md transition-all',
                                tab === t.key
                                    ? 'bg-surface-container-lowest font-semibold text-primary shadow-sm'
                                    : 'text-on-surface-variant hover:text-on-surface',
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <Input
                    className="min-w-[220px] flex-1"
                    icon="search"
                    type="search"
                    placeholder="Search by name or email"
                    aria-label="Search users"
                    value={search}
                    onChange={(e) => changeFilter(setSearch)(e.target.value)}
                />

                <Select
                    className="lg:w-48"
                    aria-label="Filter by role"
                    value={role}
                    options={ROLE_OPTIONS}
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
                <ErrorState title="Could not load users" onRetry={refetch} />
            ) : users.length === 0 ? (
                <EmptyState
                    icon="group"
                    title="No users found"
                    description="Try a different search or filter."
                />
            ) : (
                <>
                    <p className="mb-2 text-label-md text-secondary">
                        {total} {total === 1 ? 'user' : 'users'}
                    </p>
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
                title="Reinstate this account?"
                message={`${reinstateTarget?.fullName ?? 'This user'} will be able to sign in and use the marketplace again.`}
                confirmText="Reinstate"
            />
        </>
    );
};

export default AdminUsersPage;
