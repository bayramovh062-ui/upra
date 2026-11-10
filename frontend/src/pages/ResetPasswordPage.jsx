import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { resetPasswordSchema } from '../validations/authSchema';
import { useResetPasswordMutation } from '../features/auth/authApi';
import { logout } from '../features/auth/authSlice';
import { Button, Icon, PasswordInput } from '../components/ui';

const ResetPasswordPage = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [resetPassword, { isLoading }] = useResetPasswordMutation();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: { newPassword: '', confirmPassword: '' },
    });

    const onSubmit = async ({ newPassword }) => {
        try {
            await resetPassword({ token, newPassword }).unwrap();
            // Bu brauzerdə giriş edilmişdisə, köhnə sessiya artıq etibarsızdır
            dispatch(logout());
            toast.success('Password reset. Please sign in with your new password.');
            navigate('/login', { replace: true });
        } catch (err) {
            toast.error(err?.data?.message || 'Could not reset the password.');
        }
    };

    if (!token) {
        return (
            <div className="mx-auto my-auto w-full max-w-md space-y-4 py-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
                    <Icon name="link_off" className="text-[28px]" />
                </span>
                <h2 className="text-headline-lg text-on-surface">Invalid reset link</h2>
                <p className="text-body-md text-secondary">
                    This link is incomplete. Request a new password reset email and use the link from it.
                </p>
                <Link to="/forgot-password">
                    <Button size="lg">Request a new link</Button>
                </Link>
            </div>
        );
    }

    return (
        <>
            <div className="flex justify-end text-body-md text-secondary">
                <Link
                    to="/login"
                    className="inline-flex items-center gap-1 text-title-md text-primary-container transition-colors hover:text-primary"
                >
                    <Icon name="arrow_back" className="text-[16px]" />
                    Back to sign in
                </Link>
            </div>

            <div className="mx-auto my-auto w-full max-w-md py-8">
                <div className="mb-8 space-y-2">
                    <h2 className="text-headline-lg text-on-surface">Choose a new password</h2>
                    <p className="text-body-md text-secondary">
                        You will be signed out of all your devices after resetting.
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    <PasswordInput
                        label="New password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        error={errors.newPassword?.message}
                        {...register('newPassword')}
                    />
                    <PasswordInput
                        label="Confirm new password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        error={errors.confirmPassword?.message}
                        {...register('confirmPassword')}
                    />

                    <Button type="submit" size="lg" loading={isLoading} className="mt-2 w-full">
                        {isLoading ? 'Saving...' : 'Reset password'}
                    </Button>
                </form>

                <p className="mt-6 text-caption text-secondary">
                    Link expired?{' '}
                    <Link to="/forgot-password" className="font-semibold text-primary hover:text-surface-tint">
                        Request a new one
                    </Link>
                    .
                </p>
            </div>
        </>
    );
};

export default ResetPasswordPage;
