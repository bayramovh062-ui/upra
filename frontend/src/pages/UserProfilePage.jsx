import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Icon, Skeleton } from '../components/ui';
import { useGetUserProfileQuery } from '../features/users/usersApi';
import { formatDate, formatMoney } from '../lib/format';
import { availabilityLabel, availabilityTone } from '../lib/labels';

const ROLE_LABEL = { CLIENT: 'Client', FREELANCER: 'Freelancer' };

// Seçilmiş saat qurşağında indiki vaxt ("14:05")
const localTime = (timezone) => {
    try {
        return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date());
    } catch {
        return null;
    }
};

const ProfileSkeleton = () => (
    <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-3">
            <div className="flex items-center gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="flex-1">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="mt-3 h-4 w-72" />
                </div>
            </div>
        </Card>
        <Card className="p-6 lg:col-span-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
        </Card>
        <Card className="h-40 p-6" />
    </div>
);

const MetaItem = ({ icon, children }) => (
    <span className="inline-flex items-center gap-1.5">
        <Icon name={icon} className="text-[18px]" />
        {children}
    </span>
);

const StatRow = ({ label, value }) => (
    <div className="flex items-center justify-between py-2">
        <span className="text-body-md text-secondary">{label}</span>
        <span className="tabular text-title-md text-on-surface">{value}</span>
    </div>
);

const UserProfilePage = () => {
    const { id } = useParams();
    const me = useSelector((state) => state.auth.user);
    const { data, isLoading, isError, error, refetch } = useGetUserProfileQuery(id);

    if (isLoading) return <ProfileSkeleton />;

    if (isError) {
        if (error?.status === 404) {
            return (
                <EmptyState
                    icon="person_off"
                    title="User not found"
                    description="This profile does not exist or the account has been deleted."
                    action={
                        <Link to="/dashboard">
                            <Button>Back to dashboard</Button>
                        </Link>
                    }
                />
            );
        }
        return <ErrorState title="Could not load this profile" onRetry={refetch} />;
    }

    const { user, stats } = data;
    const isOwner = me?.id === user.id;
    const isPrivate = user.profilePublic === false;
    const isFreelancer = user.role === 'FREELANCER';

    // Gizli profil, başqası baxır: backend yalnız ad və rolu qaytarır
    if (isPrivate && !isOwner) {
        return (
            <div className="max-w-5xl">
                <Card className="mb-6 p-6">
                    <div className="flex items-center gap-4">
                        <Avatar name={user.fullName} size="xl" />
                        <div className="min-w-0">
                            <h1 className="truncate text-headline-lg text-on-surface">{user.fullName}</h1>
                            <Badge className="mt-2">{ROLE_LABEL[user.role]}</Badge>
                        </div>
                    </div>
                </Card>
                <EmptyState
                    icon="lock"
                    title="This profile is private"
                    description={`${user.fullName} has chosen to keep their profile details private.`}
                />
            </div>
        );
    }

    const time = user.timezone ? localTime(user.timezone) : null;
    const skills = user.skills ?? [];

    return (
        <div className="max-w-5xl">
            {isOwner && isPrivate && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-line bg-warning-soft px-4 py-3 text-body-md text-warning-ink">
                    <Icon name="lock" className="text-[18px]" />
                    <p>Your profile is private. Other members only see your name and role.</p>
                </div>
            )}

            <Card className="mb-6 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                        <Avatar name={user.fullName} src={user.avatarUrl} size="xl" />
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="break-words text-headline-lg text-on-surface">{user.fullName}</h1>
                                <Badge>{ROLE_LABEL[user.role]}</Badge>
                                {isFreelancer && user.availability && (
                                    <Badge tone={availabilityTone(user.availability)}>{availabilityLabel(user.availability)}</Badge>
                                )}
                            </div>
                            {user.headline && <p className="mt-1 text-body-lg text-on-surface">{user.headline}</p>}
                            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-body-md text-secondary">
                                {user.location && <MetaItem icon="location_on">{user.location}</MetaItem>}
                                {user.timezone && (
                                    <MetaItem icon="schedule">
                                        {time ? `${time} local time` : user.timezone}
                                        <span className="hidden sm:inline">({user.timezone.replaceAll('_', ' ')})</span>
                                    </MetaItem>
                                )}
                                <MetaItem icon="calendar_today">Member since {formatDate(user.createdAt)}</MetaItem>
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                        {isFreelancer && user.hourlyRate != null && (
                            <div className="sm:text-right">
                                <p className="tabular text-headline-md text-on-surface">{formatMoney(user.hourlyRate)}/hr</p>
                                <p className="text-caption uppercase tracking-wider text-secondary">Hourly rate</p>
                            </div>
                        )}
                        {isOwner && (
                            <Link to="/settings">
                                <Button variant="secondary" size="sm">
                                    <Icon name="edit" className="text-[16px]" />
                                    Edit profile
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="flex flex-col gap-6 lg:col-span-2">
                    <Card>
                        <CardHeader title="About" />
                        <CardBody className="pt-0">
                            {user.bio ? (
                                <p className="whitespace-pre-line break-words text-body-md text-on-surface">{user.bio}</p>
                            ) : (
                                <p className="text-body-md text-secondary">
                                    {isOwner ? 'You have not added a biography yet.' : 'No biography yet.'}
                                </p>
                            )}
                        </CardBody>
                    </Card>

                    {isFreelancer && (
                        <Card>
                            <CardHeader title="Skills" />
                            <CardBody className="pt-0">
                                {skills.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {skills.map((skill) => (
                                            <span
                                                key={skill.id}
                                                className="rounded-full bg-primary-fixed px-2.5 py-1 text-caption text-on-primary-fixed"
                                            >
                                                {skill.name}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-body-md text-secondary">
                                        {isOwner ? 'You have not added any skills yet.' : 'No skills listed yet.'}
                                    </p>
                                )}
                            </CardBody>
                        </Card>
                    )}
                </div>

                {stats && (
                    <Card className="h-fit">
                        <CardHeader title="Activity" />
                        <CardBody className="divide-y divide-line pt-0">
                            <StatRow label="Completed contracts" value={stats.completedContracts} />
                            {stats.jobsPosted != null && <StatRow label="Jobs posted" value={stats.jobsPosted} />}
                        </CardBody>
                    </Card>
                )}
            </div>

            {isOwner && !user.bio && !user.headline && (
                <p className="mt-6 text-body-md text-secondary">
                    Tip: a headline and biography help others understand what you do.{' '}
                    <Link to="/settings" className="font-medium text-primary hover:underline">
                        Complete your profile
                    </Link>
                </p>
            )}
        </div>
    );
};

export default UserProfilePage;
