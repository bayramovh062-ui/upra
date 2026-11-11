import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Icon, Skeleton } from '../components/ui';
import AvatarModal from '../components/AvatarModal';
import { useGetUserProfileQuery } from '../features/users/usersApi';
import { useTranslation } from '../features/locale/useTranslation';
import { formatDate, formatMoney } from '../lib/format';
import { availabilityLabel, availabilityTone } from '../lib/labels';
import { StarRating } from '../features/reviews/StarRating';
import { formatRating, reviewCountLabel } from '../features/reviews/reviewUtils';

// Seçilmiş saat qurşağında indiki vaxt ("14:05")
const localTime = (timezone, intlLocale) => {
    try {
        return new Intl.DateTimeFormat(intlLocale, { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date());
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

// Orta reytinq (rəylərdən törədilir). Rəy yoxdursa "No reviews yet"
const RatingSummary = ({ avgRating, reviewCount }) => {
    const { t } = useTranslation();
    const rating = formatRating(avgRating);

    if (!reviewCount || rating === null) {
        return <p className="mt-2 text-body-md text-secondary">{t('reviews.noReviews')}</p>;
    }

    return (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-body-md">
            <StarRating value={avgRating} sizeClass="text-[20px]" />
            <span className="tabular font-semibold text-on-surface">{rating}</span>
            <span className="text-secondary">({reviewCountLabel(reviewCount)})</span>
        </p>
    );
};

const UserProfilePage = () => {
    const { t, intlLocale } = useTranslation();
    const { id } = useParams();
    const me = useSelector((state) => state.auth.user);
    const { data, isLoading, isError, error, refetch } = useGetUserProfileQuery(id);
    const [avatarOpen, setAvatarOpen] = useState(false);

    if (isLoading) return <ProfileSkeleton />;

    if (isError) {
        if (error?.status === 404) {
            return (
                <EmptyState
                    icon="person_off"
                    title={t('profile.notFoundTitle')}
                    description={t('profile.notFoundText')}
                    action={
                        <Link to="/dashboard">
                            <Button>{t('profile.backToDashboard')}</Button>
                        </Link>
                    }
                />
            );
        }
        return <ErrorState title={t('profile.loadError')} onRetry={refetch} />;
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
                            <Badge className="mt-2">{t(`common.roles.${user.role}`)}</Badge>
                        </div>
                    </div>
                </Card>
                <EmptyState
                    icon="lock"
                    title={t('profile.privateTitle')}
                    description={t('profile.privateText', { name: user.fullName })}
                />
            </div>
        );
    }

    const time = user.timezone ? localTime(user.timezone, intlLocale) : null;
    const skills = user.skills ?? [];

    return (
        <div className="max-w-5xl">
            {isOwner && isPrivate && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-line bg-warning-soft px-4 py-3 text-body-md text-warning-ink">
                    <Icon name="lock" className="text-[18px]" />
                    <p>{t('profile.ownerPrivateNotice')}</p>
                </div>
            )}

            <Card className="mb-6 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                        <button type="button" onClick={() => setAvatarOpen(true)} className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container" aria-label={t('profile.viewPhoto')}>
                            <Avatar name={user.fullName} src={user.avatarUrl} size="xl" />
                            {user.avatarUrl && (
                                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                                    <Icon name="zoom_in" />
                                </span>
                            )}
                        </button>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="break-words text-headline-lg text-on-surface">{user.fullName}</h1>
                                <Badge>{t(`common.roles.${user.role}`)}</Badge>
                                {isFreelancer && user.availability && (
                                    <Badge tone={availabilityTone(user.availability)}>{availabilityLabel(user.availability)}</Badge>
                                )}
                            </div>
                            {user.headline && <p className="mt-1 text-body-lg text-on-surface">{user.headline}</p>}
                            {stats && <RatingSummary avgRating={stats.avgRating} reviewCount={stats.reviewCount} />}
                            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-body-md text-secondary">
                                {user.location && <MetaItem icon="location_on">{user.location}</MetaItem>}
                                {user.timezone && (
                                    <MetaItem icon="schedule">
                                        {time ? t('profile.localTime', { time }) : user.timezone}
                                        <span className="hidden sm:inline">({user.timezone.replaceAll('_', ' ')})</span>
                                    </MetaItem>
                                )}
                                <MetaItem icon="calendar_today">
                                    {t('profile.memberSince', { date: formatDate(user.createdAt) })}
                                </MetaItem>
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                        {isFreelancer && user.hourlyRate != null && (
                            <div className="sm:text-right">
                                <p className="tabular text-headline-md text-on-surface">
                                    {formatMoney(user.hourlyRate)}
                                    {t('profile.perHour')}
                                </p>
                                <p className="text-caption uppercase tracking-wider text-secondary">{t('profile.hourlyRate')}</p>
                            </div>
                        )}
                        {isOwner && (
                            <Link to="/settings">
                                <Button variant="secondary" size="sm">
                                    <Icon name="edit" className="text-[16px]" />
                                    {t('profile.editProfile')}
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="flex flex-col gap-6 lg:col-span-2">
                    <Card>
                        <CardHeader title={t('profile.about')} />
                        <CardBody className="pt-0">
                            {user.bio ? (
                                <p className="whitespace-pre-line break-words text-body-md text-on-surface">{user.bio}</p>
                            ) : (
                                <p className="text-body-md text-secondary">
                                    {isOwner ? t('profile.noBioOwner') : t('profile.noBio')}
                                </p>
                            )}
                        </CardBody>
                    </Card>

                    {isFreelancer && (
                        <Card>
                            <CardHeader title={t('profile.skills')} />
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
                                        {isOwner ? t('profile.noSkillsOwner') : t('profile.noSkills')}
                                    </p>
                                )}
                            </CardBody>
                        </Card>
                    )}
                </div>

                {stats && (
                    <Card className="h-fit">
                        <CardHeader title={t('profile.activity')} />
                        <CardBody className="divide-y divide-line pt-0">
                            <StatRow label={t('profile.completedContracts')} value={stats.completedContracts} />
                            <StatRow
                                label={t('profile.averageRating')}
                                value={
                                    formatRating(stats.avgRating)
                                        ? t('profile.ratingValue', { rating: formatRating(stats.avgRating) })
                                        : t('common.labels.noValue')
                                }
                            />
                            <StatRow label={t('profile.reviewsReceived')} value={stats.reviewCount ?? 0} />
                            {stats.jobsPosted != null && <StatRow label={t('profile.jobsPosted')} value={stats.jobsPosted} />}
                        </CardBody>
                    </Card>
                )}
            </div>

            {isOwner && !user.bio && !user.headline && (
                <p className="mt-6 text-body-md text-secondary">
                    {t('profile.tip')}{' '}
                    <Link to="/settings" className="font-medium text-primary hover:underline">
                        {t('profile.completeProfile')}
                    </Link>
                </p>
            )}

            <AvatarModal open={avatarOpen} onClose={() => setAvatarOpen(false)} src={user.avatarUrl} name={user.fullName} />
        </div>
    );
};

export default UserProfilePage;
