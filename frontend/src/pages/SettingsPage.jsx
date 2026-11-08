import { useRef, useState } from 'react';
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
import SkillPicker from '../features/taxonomy/SkillPicker';
import { cn } from '../lib/cn';
import { formatDate, getErrorMessage } from '../lib/format';
import { AVAILABILITY_OPTIONS, TIMEZONES } from '../lib/labels';
import { passwordSchema, professionalSchema, profileSchema } from '../validations/settingsSchema';

// Boş sahə backend-ə "" kimi gedir və orada null olur
const toFormText = (value) => value ?? '';

const SaveButton = ({ loading, disabled, children = 'Save changes' }) => (
    <div className="flex justify-end">
        <Button type="submit" loading={loading} disabled={disabled}>
            {children}
        </Button>
    </div>
);

// Şəxsi məlumat: ad, avatar (Plan P3 fayl yükləmə + URL fallback), məkan, saat qurşağı (hər iki rol)
const ProfileForm = ({ user }) => {
    const [updateMe, { isLoading }] = useUpdateMeMutation();
    const [uploadAvatar, { isLoading: uploadingAvatar }] = useUploadAvatarMutation();
    const fileRef = useRef(null);
    const [avatarModalOpen, setAvatarModalOpen] = useState(false);
    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors, isDirty },
    } = useForm({
        resolver: zodResolver(profileSchema),
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
            toast.success('Personal information updated');
            reset(values);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not update your profile'));
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
            toast.success('Avatar uploaded');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not upload avatar'));
        }
    };

    return (
        <Card>
            <CardHeader title="Personal information" />
            <CardBody>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <button type="button" onClick={() => setAvatarModalOpen(true)} className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container" aria-label="View profile photo">
                            <Avatar name={fullName} src={errors.avatarUrl ? null : avatarPreview} size="xl" />
                            {avatarPreview && (
                                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                                    <Icon name="zoom_in" />
                                </span>
                            )}
                        </button>
                        <div className="flex flex-wrap items-center gap-3 text-body-md text-secondary">
                            <Badge>{user.role === 'CLIENT' ? 'Client' : 'Freelancer'}</Badge>
                            {user.createdAt && <span>Member since {formatDate(user.createdAt)}</span>}
                            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onAvatarFile} />
                            <Button type="button" variant="secondary" size="sm" loading={uploadingAvatar} onClick={() => fileRef.current?.click()}>
                                <Icon name="upload" className="text-[16px]" />
                                Upload photo
                            </Button>
                        </div>
                    </div>
                    <Input label="Full name" error={errors.fullName?.message} {...register('fullName')} />
                    <Input label="Email" value={user.email ?? ''} disabled readOnly hint="Email cannot be changed" />
                    <Input
                        label="Avatar URL (optional)"
                        type="url"
                        placeholder="https://example.com/photo.jpg"
                        hint="Use Upload photo (stored securely) or paste an image URL. Leave empty to show your initials."
                        error={errors.avatarUrl?.message}
                        {...register('avatarUrl')}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            label="Location"
                            placeholder="City, Country"
                            icon="location_on"
                            error={errors.location?.message}
                            {...register('location')}
                        />
                        <Select
                            label="Time zone"
                            placeholder="Not set"
                            options={timezoneOptions}
                            error={errors.timezone?.message}
                            {...register('timezone')}
                        />
                    </div>
                    <SaveButton loading={isLoading} disabled={!isDirty} />
                </form>

                <AvatarModal
                    open={avatarModalOpen}
                    onClose={() => setAvatarModalOpen(false)}
                    src={errors.avatarUrl ? null : avatarPreview}
                    name={fullName}
                    editable={Boolean(avatarPreview)}
                    onSave={() => {
                        toast('Framing preview applied locally. Saving a cropped avatar requires a backend crop endpoint.', { icon: 'ℹ️' });
                        setAvatarModalOpen(false);
                    }}
                />
            </CardBody>
        </Card>
    );
};

// Peşəkar məlumat: başlıq və bio hər iki rol üçün, saat haqqı və əlçatanlıq yalnız frilanser üçün
const ProfessionalForm = ({ user }) => {
    const isFreelancer = user.role === 'FREELANCER';
    const [updateMe, { isLoading }] = useUpdateMeMutation();
    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors, isDirty },
    } = useForm({
        resolver: zodResolver(professionalSchema),
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
            toast.success('Professional information updated');
            reset(values);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not update your profile'));
        }
    };

    return (
        <Card>
            <CardHeader title="Professional information" />
            <CardBody>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                    <Input
                        label="Professional headline"
                        placeholder={isFreelancer ? 'e.g. Senior React & Node.js developer' : 'e.g. Product lead at Acme'}
                        error={errors.headline?.message}
                        {...register('headline')}
                    />
                    <Textarea
                        label="Biography"
                        rows={6}
                        placeholder="Tell others about your experience, what you work on and how you like to collaborate."
                        hint={`${bioLength}/1000 characters`}
                        error={errors.bio?.message}
                        {...register('bio')}
                    />
                    {isFreelancer && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Hourly rate (USD)"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                placeholder="e.g. 45"
                                icon="payments"
                                hint="Leave empty to hide your rate"
                                error={errors.hourlyRate?.message}
                                {...register('hourlyRate')}
                            />
                            <Select
                                label="Availability"
                                options={AVAILABILITY_OPTIONS}
                                error={errors.availability?.message}
                                {...register('availability')}
                            />
                        </div>
                    )}
                    <SaveButton loading={isLoading} disabled={!isDirty} />
                </form>
            </CardBody>
        </Card>
    );
};

// Görünürlük: dərhal yadda saxlanılır. Gizli profildə başqaları yalnız ad və rolu görür
const VisibilityForm = ({ user }) => {
    const [updateMe, { isLoading }] = useUpdateMeMutation();
    const isPublic = user.profilePublic !== false;

    const toggle = async () => {
        try {
            await updateMe({ profilePublic: !isPublic }).unwrap();
            toast.success(isPublic ? 'Your profile is now private' : 'Your profile is now public');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not update profile visibility'));
        }
    };

    return (
        <Card>
            <CardHeader title="Profile visibility" />
            <CardBody>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-body-md font-medium text-on-surface">Public profile</p>
                        <p className="mt-1 max-w-md text-body-md text-secondary">
                            {isPublic
                                ? 'Other Upra members can see your headline, biography, skills, rate, location and stats.'
                                : 'Your profile is private. Other members only see your name and role.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={isPublic}
                        aria-label="Public profile"
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
    const [updateMe, { isLoading }] = useUpdateMeMutation();
    const saved = (user.skills ?? []).map((s) => (typeof s === 'string' ? s : s.name));
    const [skills, setSkills] = useState(saved);

    const dirty =
        skills.length !== saved.length || skills.some((name) => !saved.some((s) => s.toLowerCase() === name.toLowerCase()));

    const onSave = async () => {
        try {
            await updateMe({ skills }).unwrap();
            toast.success('Skills updated');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not update your skills'));
        }
    };

    return (
        <Card>
            <CardHeader title="Skills" />
            <CardBody className="flex flex-col gap-4">
                <p className="text-body-md text-secondary">
                    Add the skills you work with. Jobs that require them are shown under "Matched to your skills".
                </p>
                <SkillPicker value={skills} onChange={setSkills} max={15} />
                <div className="flex justify-end">
                    <Button onClick={onSave} loading={isLoading} disabled={!dirty}>
                        Save skills
                    </Button>
                </div>
            </CardBody>
        </Card>
    );
};

const PasswordForm = () => {
    const [updatePassword, { isLoading }] = useUpdatePasswordMutation();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(passwordSchema),
        defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    });

    const onSubmit = async ({ currentPassword, newPassword }) => {
        try {
            await updatePassword({ currentPassword, newPassword }).unwrap();
            toast.success('Password updated');
            reset();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not update the password'));
        }
    };

    return (
        <Card>
            <CardHeader title="Password" />
            <CardBody>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                    <PasswordInput
                        label="Current password"
                        autoComplete="current-password"
                        error={errors.currentPassword?.message}
                        {...register('currentPassword')}
                    />
                    <PasswordInput
                        label="New password"
                        autoComplete="new-password"
                        error={errors.newPassword?.message}
                        {...register('newPassword')}
                    />
                    <PasswordInput
                        label="Confirm new password"
                        autoComplete="new-password"
                        error={errors.confirmPassword?.message}
                        {...register('confirmPassword')}
                    />
                    <div className="flex justify-end">
                        <Button type="submit" loading={isLoading}>
                            Update password
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
};

// Hesabı silmə: parol təsdiqi ilə. Aktiv müqavilə varsa backend 400 qaytarır və mesajı toast-da göstərilir.
const DangerZone = () => {
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
            toast.success('Your account has been deleted');
            logout();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not delete the account'));
        }
    };

    return (
        <>
            <Card className="border-error">
                <CardHeader title="Danger zone" />
                <CardBody>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <p className="max-w-md text-body-md text-secondary">
                            Deleting your account cannot be undone. Your contract history stays visible to the other
                            party, but your personal data is removed. Active contracts must be completed or cancelled
                            first.
                        </p>
                        <Button variant="danger" onClick={() => setOpen(true)}>
                            Delete account
                        </Button>
                    </div>
                </CardBody>
            </Card>

            <Modal
                open={open}
                onClose={close}
                title="Delete your account?"
                footer={
                    <>
                        <Button variant="secondary" onClick={close} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={onConfirm} loading={isLoading} disabled={!password}>
                            Delete account
                        </Button>
                    </>
                }
            >
                <PasswordInput
                    label="Confirm with your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </Modal>
        </>
    );
};

const SettingsPage = () => {
    const user = useSelector((state) => state.auth.user);
    if (!user) return null;

    // key: profil store-a gec gələndə (girişdən sonra getMe) və ya yadda saxlananda forma yeni dəyərlərlə qurulsun
    const personalKey = [user.id, user.fullName, user.avatarUrl, user.location, user.timezone].join('|');
    const professionalKey = [user.id, user.headline, user.bio, user.hourlyRate, user.availability].join('|');

    return (
        <>
            <PageHeader
                title="Settings"
                description="Manage your profile, visibility, password and account."
                action={
                    <Link to={`/users/${user.id}`}>
                        <Button variant="secondary">
                            <Icon name="visibility" className="text-[18px]" />
                            View public profile
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
