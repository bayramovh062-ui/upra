import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Badge, Button, Card, CardBody, CardHeader, Input, Modal, PageHeader, PasswordInput } from '../components/ui';
import {
    useDeleteAccountMutation,
    useUpdateMeMutation,
    useUpdatePasswordMutation,
} from '../features/auth/authApi';
import { useLogout } from '../features/auth/useLogout';
import SkillPicker from '../features/taxonomy/SkillPicker';
import { formatDate, getErrorMessage } from '../lib/format';
import { passwordSchema, profileSchema } from '../validations/settingsSchema';

const ProfileForm = ({ user }) => {
    const [updateMe, { isLoading }] = useUpdateMeMutation();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm({ resolver: zodResolver(profileSchema), defaultValues: { fullName: user.fullName } });

    const onSubmit = async (values) => {
        try {
            await updateMe(values).unwrap();
            toast.success('Profile updated');
            reset(values);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not update your profile'));
        }
    };

    return (
        <Card>
            <CardHeader title="Profile" />
            <CardBody>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                    <Input label="Full name" error={errors.fullName?.message} {...register('fullName')} />
                    <Input label="Email" value={user.email ?? ''} disabled readOnly hint="Email cannot be changed" />
                    <div className="flex flex-wrap items-center gap-3 text-body-md text-secondary">
                        <Badge>{user.role === 'CLIENT' ? 'Client' : 'Freelancer'}</Badge>
                        {user.createdAt && <span>Member since {formatDate(user.createdAt)}</span>}
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" loading={isLoading} disabled={!isDirty}>
                            Save changes
                        </Button>
                    </div>
                </form>
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

    return (
        <>
            <PageHeader title="Settings" description="Manage your account details and password." />
            <div className="grid max-w-3xl grid-cols-1 gap-6">
                <ProfileForm user={user} />
                {user.role === 'FREELANCER' && (
                    // key: bacarıqlar store-a gec gələndə (girişdən sonra getMe) forma təzələnsin, boş siyahı ilə üstünə yazılmasın
                    <SkillsForm key={(user.skills ?? []).map((s) => (typeof s === 'string' ? s : s.name)).join('|')} user={user} />
                )}
                <PasswordForm />
                <DangerZone />
            </div>
        </>
    );
};

export default SettingsPage;
