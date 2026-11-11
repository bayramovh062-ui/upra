import { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import {
    Avatar,
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    Icon,
    Input,
    Modal,
    PageHeader,
    PasswordInput,
    Select,
    Textarea,
} from '../components/ui';
import AvatarModal from '../components/AvatarModal';
import {
    useDeleteAccountMutation,
    useUpdateMeMutation,
    useUpdatePasswordMutation,
} from '../features/auth/authApi';
import { useUploadAvatarMutation } from '../features/attachments/attachmentsApi';
import { useLogout } from '../features/auth/useLogout';
import { useTranslation } from '../features/locale/useTranslation';
import SkillPicker from '../features/taxonomy/SkillPicker';
import { cn } from '../lib/cn';
import { formatDate, getErrorMessage } from '../lib/format';
import { availabilityOptions, TIMEZONES } from '../lib/labels';
import {
    createPasswordSchema,
    createProfessionalSchema,
    createProfileSchema,
} from '../validations/settingsSchema';

// Boş sahə backend-ə "" kimi gedir və orada null olur
const toFormText = (value) => value ?? '';

const SaveButton = ({ loading, disabled, children }) => (
    <div className="flex justify-end">
        <Button type="submit" loading={loading} disabled={disabled}>
            {children}
        </Button>
    </div>
);

// Şəxsi məlumat: ad, avatar (Plan P3 fayl yükləmə + URL fallback), məkan, saat qurşağı (hər iki rol)
const ProfileForm = ({ user }) => {
    const { t } = useTranslation();
    const [updateMe, { isLoading }] = useUpdateMeMutation();
    const [uploadAvatar, { isLoading: uploadingAvatar }] = useUploadAvatarMutation();
    const fileRef = useRef(null);
    const [avatarModalOpen, setAvatarModalOpen] = useState(false);
    const resolver = useMemo(() => zodResolver(createProfileSchema(t)), [t]);
    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors, isDirty },
    } = useForm({
        resolver,
        defaultValues: {
            fullName: user.fullName,
            avatarUrl: toFormText(user.avatarUrl),
            location: toFormText(user.location),
            timezone: toFormText(user.timezone),
        },
    });

    // Canlı avatar önizləməsi
    const [avatarPreview, fullName] = useWatch({ control, name: ['avatarUrl', 'fullName'] });
    const timezoneOptions = TIMEZONES.map((zone) => ({ value: zone, label: zone.replaceAll('_', ' ') }));

    const onSubmit = async (values) => {
        try {
            await updateMe(values).unwrap();
            toast.success(t('settings.profile.saved'));
            reset(values);
        } catch (err) {
            toast.error(getErrorMessage(err, t('settings.profile.saveError')));
        }
    };

    const onAvatarFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const res = await uploadAvatar(file).unwrap();
            const url = res?.avatarUrl;
            if (url) {
                reset({ ...control._formValues, avatarUrl: url }, { keepDirtyValues: true, keepDefaultValues: true });
            }
            toast.success(t('settings.profile.avatarUploaded'));
        } catch (err) {
            toast.error(getErrorMessage(err, t('settings.profile.avatarError')));
        }
    };

    return (
        <Card>
            <CardHeader title={t('settings.profile.title')} />
            <CardBody>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <button type="button" onClick={() => setAvatarModalOpen(true)} className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container" aria-label={t('settings.profile.viewPhoto')}>
                            <Avatar name={fullName} src={errors.avatarUrl ? null : avatarPreview} size="xl" />
                            {avatarPreview && (
                                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                                    <Icon name="zoom_in" />
                                </span>
                            )}
                        </button>
                        <div className="flex flex-wrap items-center gap-3 text-body-md text-secondary">
                            <Badge>{t(`common.roles.${user.role}`)}</Badge>
                            {user.createdAt && (
                                <span>{t('settings.memberSince', { date: formatDate(user.createdAt) })}</span>
                            )}
                            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onAvatarFile} />
                            <Button type="button" variant="secondary" size="sm" loading={uploadingAvatar} onClick={() => fileRef.current?.click()}>
                                <Icon name="upload" className="text-[16px]" />
                                {t('settings.profile.uploadPhoto')}
                            </Button>
                        </div>
                    </div>
                    <Input label={t('settings.profile.fullName')} error={errors.fullName?.message} {...register('fullName')} />
                    <Input label={t('settings.profile.email')} value={user.email ?? ''} disabled readOnly hint={t('settings.profile.emailHint')} />
                    <Input
                        label={t('settings.profile.avatarUrl')}
                        type="url"
                        placeholder={t('settings.profile.avatarPlaceholder')}
                        hint={t('settings.profile.avatarHint')}
                        error={errors.avatarUrl?.message}
                        {...register('avatarUrl')}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            label={t('settings.profile.location')}
                            placeholder={t('settings.profile.locationPlaceholder')}
                            icon="location_on"
                            error={errors.location?.message}
                            {...register('location')}
                        />
                        <Select
                            label={t('settings.profile.timezone')}
                            placeholder={t('settings.profile.timezonePlaceholder')}
                            options={timezoneOptions}
                            error={errors.timezone?.message}
                            {...register('timezone')}
                        />
                    </div>
                    <SaveButton loading={isLoading} disabled={!isDirty}>
                        {t('settings.saveChanges')}
                    </SaveButton>
                </form>

                <AvatarModal
                    open={avatarModalOpen}
                    onClose={() => setAvatarModalOpen(false)}
                    src={errors.avatarUrl ? null : avatarPreview}
                    name={fullName}
                    editable={Boolean(avatarPreview)}
                    onSave={() => {
                        toast(t('settings.profile.framingInfo'), { icon: 'ℹ️' });
                        setAvatarModalOpen(false);
                    }}
                />
            </CardBody>
        </Card>
    );
};

// Peşəkar məlumat: başlıq və bio hər iki rol üçün, saat haqqı və əlçatanlıq yalnız frilanser üçün
const ProfessionalForm = ({ user }) => {
    const { t } = useTranslation();
    const isFreelancer = user.role === 'FREELANCER';
    const [updateMe, { isLoading }] = useUpdateMeMutation();
    const resolver = useMemo(() => zodResolver(createProfessionalSchema(t)), [t]);
    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors, isDirty },
    } = useForm({
        resolver,
        defaultValues: {
            headline: toFormText(user.headline),
            bio: toFormText(user.bio),
            hourlyRate: user.hourlyRate != null ? String(Number(user.hourlyRate)) : '',
            availability: user.availability ?? 'AVAILABLE',
        },
    });

    const bioLength = useWatch({ control, name: 'bio' })?.length ?? 0;

    const onSubmit = async (values) => {
        const body = { headline: values.headline, bio: values.bio };
        if (isFreelancer) {
            body.hourlyRate = values.hourlyRate === '' ? null : Number(values.hourlyRate);
            body.availability = values.availability;
        }
        try {
            await updateMe(body).unwrap();
            toast.success(t('settings.professional.saved'));
            reset(values);
        } catch (err) {
            toast.error(getErrorMessage(err, t('settings.professional.saveError')));
        }
    };

    return (
        <Card>
            <CardHeader title={t('settings.professional.title')} />
            <CardBody>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                    <Input
                        label={t('settings.professional.headline')}
                        placeholder={t(
                            isFreelancer
                                ? 'settings.professional.headlinePlaceholderFreelancer'
                                : 'settings.professional.headlinePlaceholderClient'
                        )}
                        error={errors.headline?.message}
                        {...register('headline')}
                    />
                    <Textarea
                        label={t('settings.professional.bio')}
                        rows={6}
                        placeholder={t('settings.professional.bioPlaceholder')}
                        hint={t('settings.professional.bioCount', { count: bioLength })}
                        error={errors.bio?.message}
                        {...register('bio')}
                    />
                    {isFreelancer && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label={t('settings.professional.hourlyRate')}
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                placeholder={t('settings.professional.hourlyRatePlaceholder')}
                                icon="payments"
                                hint={t('settings.professional.hourlyRateHint')}
                                error={errors.hourlyRate?.message}
                                {...register('hourlyRate')}
                            />
                            <Select
                                label={t('settings.professional.availability')}
                                options={availabilityOptions()}
                                error={errors.availability?.message}
                                {...register('availability')}
                            />
                        </div>
                    )}
                    <SaveButton loading={isLoading} disabled={!isDirty}>
                        {t('settings.saveChanges')}
                    </SaveButton>
                </form>
            </CardBody>
        </Card>
    );
};

// Görünürlük: dərhal yadda saxlanılır. Gizli profildə başqaları yalnız ad və rolu görür
const VisibilityForm = ({ user }) => {
    const { t } = useTranslation();
    const [updateMe, { isLoading }] = useUpdateMeMutation();
    const isPublic = user.profilePublic !== false;

    const toggle = async () => {
        try {
            await updateMe({ profilePublic: !isPublic }).unwrap();
            toast.success(isPublic ? t('settings.visibility.becamePrivate') : t('settings.visibility.becamePublic'));
        } catch (err) {
            toast.error(getErrorMessage(err, t('settings.visibility.error')));
        }
    };

    return (
        <Card>
            <CardHeader title={t('settings.visibility.title')} />
            <CardBody>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-body-md font-medium text-on-surface">{t('settings.visibility.public')}</p>
                        <p className="mt-1 max-w-md text-body-md text-secondary">
                            {isPublic
                                ? t('settings.visibility.publicDescription')
                                : t('settings.visibility.privateDescription')}
                        </p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={isPublic}
                        aria-label={t('settings.visibility.public')}
                        onClick={toggle}
                        disabled={isLoading}
                        className={cn(
                            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            isPublic ? 'bg-primary-container' : 'bg-outline-variant'
                        )}
                    >
                        <span
                            className={cn(
                                'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                                isPublic ? 'translate-x-5' : 'translate-x-0.5'
                            )}
                        />
                    </button>
                </div>
            </CardBody>
        </Card>
    );
};

// Frilanserin bacarıqları: "Matched to your skills" tab-ı və elanlardakı uyğunluq faizi bunlara əsaslandırılır
const SkillsForm = ({ user }) => {
    const { t } = useTranslation();
    const [updateMe, { isLoading }] = useUpdateMeMutation();
    const saved = (user.skills ?? []).map((s) => (typeof s === 'string' ? s : s.name));
    const [skills, setSkills] = useState(saved);

    const dirty =
        skills.length !== saved.length || skills.some((name) => !saved.some((s) => s.toLowerCase() === name.toLowerCase()));

    const onSave = async () => {
        try {
            await updateMe({ skills }).unwrap();
            toast.success(t('settings.skills.saved'));
        } catch (err) {
            toast.error(getErrorMessage(err, t('settings.skills.error')));
        }
    };

    return (
        <Card>
            <CardHeader title={t('settings.skills.title')} />
            <CardBody className="flex flex-col gap-4">
                <p className="text-body-md text-secondary">{t('settings.skills.description')}</p>
                <SkillPicker value={skills} onChange={setSkills} max={15} />
                <div className="flex justify-end">
                    <Button onClick={onSave} loading={isLoading} disabled={!dirty}>
                        {t('settings.skills.save')}
                    </Button>
                </div>
            </CardBody>
        </Card>
    );
};

const PasswordForm = () => {
    const { t } = useTranslation();
    const [updatePassword, { isLoading }] = useUpdatePasswordMutation();
    const resolver = useMemo(() => zodResolver(createPasswordSchema(t)), [t]);
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm({
        resolver,
        defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    });

    const onSubmit = async ({ currentPassword, newPassword }) => {
        try {
            await updatePassword({ currentPassword, newPassword }).unwrap();
            toast.success(t('settings.password.saved'));
            reset();
        } catch (err) {
            toast.error(getErrorMessage(err, t('settings.password.error')));
        }
    };

    return (
        <Card>
            <CardHeader title={t('settings.password.title')} />
            <CardBody>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                    <PasswordInput
                        label={t('settings.password.current')}
                        autoComplete="current-password"
                        error={errors.currentPassword?.message}
                        {...register('currentPassword')}
                    />
                    <PasswordInput
                        label={t('settings.password.new')}
                        autoComplete="new-password"
                        error={errors.newPassword?.message}
                        {...register('newPassword')}
                    />
                    <PasswordInput
                        label={t('settings.password.confirm')}
                        autoComplete="new-password"
                        error={errors.confirmPassword?.message}
                        {...register('confirmPassword')}
                    />
                    <div className="flex justify-end">
                        <Button type="submit" loading={isLoading}>
                            {t('settings.password.update')}
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
};

// Hesabı silmə: parol təsdiqi ilə. Aktiv müqavilə varsa backend 400 qaytarır və mesajı toast-da göstərilir.
const DangerZone = () => {
    const { t } = useTranslation();
    const [deleteAccount, { isLoading }] = useDeleteAccountMutation();
    const logout = useLogout();
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState('');

    const close = () => {
        setOpen(false);
        setPassword('');
    };

    const onConfirm = async () => {
        try {
            await deleteAccount({ password }).unwrap();
            toast.success(t('settings.danger.deleted'));
            logout();
        } catch (err) {
            toast.error(getErrorMessage(err, t('settings.danger.error')));
        }
    };

    return (
        <>
            <Card className="border-error">
                <CardHeader title={t('settings.danger.title')} />
                <CardBody>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <p className="max-w-md text-body-md text-secondary">{t('settings.danger.description')}</p>
                        <Button variant="danger" onClick={() => setOpen(true)}>
                            {t('settings.danger.deleteAccount')}
                        </Button>
                    </div>
                </CardBody>
            </Card>

            <Modal
                open={open}
                onClose={close}
                title={t('settings.danger.modalTitle')}
                footer={
                    <>
                        <Button variant="secondary" onClick={close} disabled={isLoading}>
                            {t('common.actions.cancel')}
                        </Button>
                        <Button variant="danger" onClick={onConfirm} loading={isLoading} disabled={!password}>
                            {t('settings.danger.deleteAccount')}
                        </Button>
                    </>
                }
            >
                <PasswordInput
                    label={t('settings.danger.confirmWithPassword')}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </Modal>
        </>
    );
};

const SettingsPage = () => {
    const { t } = useTranslation();
    const user = useSelector((state) => state.auth.user);
    if (!user) return null;

    // key: profil store-a gec gələndə (girişdən sonra getMe) və ya yadda saxlananda forma yeni dəyərlərlə qurulsun
    const personalKey = [user.id, user.fullName, user.avatarUrl, user.location, user.timezone].join('|');
    const professionalKey = [user.id, user.headline, user.bio, user.hourlyRate, user.availability].join('|');

    return (
        <>
            <PageHeader
                title={t('settings.page.title')}
                description={t('settings.page.description')}
                action={
                    <Link to={`/users/${user.id}`}>
                        <Button variant="secondary">
                            <Icon name="visibility" className="text-[18px]" />
                            {t('settings.page.viewPublicProfile')}
                        </Button>
                    </Link>
                }
            />
            <div className="grid max-w-3xl grid-cols-1 gap-6">
                <ProfileForm key={personalKey} user={user} />
                <ProfessionalForm key={professionalKey} user={user} />
                {user.role === 'FREELANCER' && (
                    // key: bacarıqlar store-a gec gələndə (girişdən sonra getMe) forma təzələnsin, boş siyahı ilə üstünə yazılmasın
                    <SkillsForm key={(user.skills ?? []).map((s) => (typeof s === 'string' ? s : s.name)).join('|')} user={user} />
                )}
                <VisibilityForm user={user} />
                <PasswordForm />
                <DangerZone />
            </div>
        </>
    );
};

export default SettingsPage;
