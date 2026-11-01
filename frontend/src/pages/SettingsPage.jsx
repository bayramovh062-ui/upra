import { useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Badge, Button, Card, CardBody, CardHeader, Input, PageHeader, PasswordInput } from '../components/ui';
import { useUpdateMeMutation, useUpdatePasswordMutation } from '../features/auth/authApi';
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

const SettingsPage = () => {
    const user = useSelector((state) => state.auth.user);
    if (!user) return null;

    return (
        <>
            <PageHeader title="Settings" description="Manage your account details and password." />
            <div className="grid max-w-3xl grid-cols-1 gap-6">
                <ProfileForm user={user} />
                <PasswordForm />
            </div>
        </>
    );
};

export default SettingsPage;
